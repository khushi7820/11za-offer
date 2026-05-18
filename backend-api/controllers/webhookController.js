const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getOrCreateUser, updateUser } = require("../services/userStateService");
const { generateAIResponse } = require("../services/aiService");
const claimService = require("../services/claimService");
const walletService = require("../services/walletService");
const supabase = require("../config/supabaseClient");

exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }
  if (req.query["verify"] === "true") {
      return res.status(200).send("Verified");
  }
  return res.sendStatus(403);
};

exports.receiveMessage = async (req, res) => {
  // 1. Log EVERY request to help debug blank logs
  console.log("--- INCOMING WEBHOOK ---");
  console.log("Body Keys:", Object.keys(req.body || {}));
  
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const rawFrom = entry?.from || req.body?.from || req.body?.sender;
    const text = entry?.text?.body || req.body?.content?.text || req.body?.UserResponse || req.body?.text || req.body?.message;

    if (!rawFrom || !text) {
        console.log("Skipping: No sender or no text content. Body:", JSON.stringify(req.body));
        return res.status(200).send("NO_MESSAGE");
    }

    const cleanNumber = String(rawFrom).replace("@s.whatsapp.net", "").replace("+", "").trim();

    const lowerMessage = text.toLowerCase().trim();
    
    // 1. FRESH STATE FETCHING
    const freshUser = await getOrCreateUser(cleanNumber);
    if (!freshUser) return res.status(200).send("USER_NOT_FOUND");
    
    const currentStep = freshUser.current_step || 'completed';
    const userCity = (freshUser.city || '').trim();
    const customerName = freshUser.customer_name || 'Customer';

    console.log(`[LOG] Phone: ${cleanNumber} | Msg: "${text}" | State: ${currentStep}`);

    // 2. ONBOARDING (HIGHEST PRIORITY)
    if (!freshUser.onboarding_completed) {
        if (currentStep === 'wait_name') {
            const extractNamePrompt = `User said: "${text}". Extract ONLY the person's real name mentioned. Ignore greeting words or conversational phrases (like hi, hello, my name is, I am, name is, name, naam, mera naam hai, etc.) and return ONLY the clean name with proper capitalization. If no valid name can be extracted, return the input itself. No punctuation.`;
            let cleanName = await generateAIResponse(extractNamePrompt, "System");
            cleanName = cleanName.replace(/[.!?]/g, "").trim();

            if (!cleanName) {
                cleanName = text.trim();
            }

            await updateUser(cleanNumber, { customer_name: cleanName, current_step: 'wait_city' });
            await sendWhatsAppMessage(cleanNumber, "Which city are you from? 📍");
            return res.status(200).send("ONBOARDING_CITY");
        } else if (currentStep === 'wait_city') {
            // 1. Use AI to extract clean city name
            const extractCityPrompt = `User said: "${text}". Extract ONLY the valid Indian city name mentioned. If the input is NOT a real city in India, you MUST reply with exactly the word: INVALID. Return ONLY the city name or INVALID, nothing else. No punctuation.`;
            let city = await generateAIResponse(extractCityPrompt, "System");
            city = city.replace(/[.!?]/g, "").trim();

            if (city.toUpperCase() === 'INVALID') {
                await sendWhatsAppMessage(cleanNumber, "Please enter a valid city name in India. 📍");
                return res.status(200).send("INVALID_CITY");
            }

            // 2. Create Customer record
            const { data: customer, error: customerError } = await supabase.from("customers").insert([{ customer_name: freshUser.customer_name, mobile_number: cleanNumber, city: city }]).select().single();
            if (customerError) return res.status(200).send("DB_ERROR");
            
            await walletService.addTransaction({ customer_id: customer.id, amount: 100, type: 'welcome_bonus', description: 'Welcome Bonus 🎉' });
            await updateUser(cleanNumber, { city, customer_id: customer.id, onboarding_completed: true, current_step: 'completed' });
            await sendWhatsAppMessage(cleanNumber, `Awesome 😊\nYou'll now receive offers for ${city} only 🎁\n\n🎁 *Welcome Gift!* ₹100 has been added to your wallet! 💰`);
            return res.status(200).send("ONBOARDING_DONE");
        } else {
            await sendWhatsAppMessage(cleanNumber, "Welcome to 11za 🎉\nWhat is your name? 😊");
            await updateUser(cleanNumber, { current_step: 'wait_name' });
            return res.status(200).send("ONBOARDING_START");
        }
    }

    // 3. MENU KEYWORDS / RESET
    const menuKeywords = ['menu', 'hi', 'hello', 'reset', 'hey', 'hii', 'options', 'start'];
    if (menuKeywords.includes(lowerMessage)) {
        if (lowerMessage === 'reset') {
            await updateUser(cleanNumber, { onboarding_completed: false, current_step: 'wait_name', customer_name: null, city: null });
            await sendWhatsAppMessage(cleanNumber, "Welcome to 11za 🎉\nWhat is your name? 😊");
            return res.status(200).send("RESET");
        }
        const menuMsg = `🏠 11za Menu\n\n1️⃣ Offers\n2️⃣ Wallet\n3️⃣ Categories\n4️⃣ My Claims\n5️⃣ Help\n\n📍 Type "change city" to update your location.`;
        await sendWhatsAppMessage(cleanNumber, menuMsg);
        await updateUser(cleanNumber, { current_step: 'completed' });
        return res.status(200).send("MENU_SENT");
    }

    // 4. CONFIRMING CLAIM (TOP PRIORITY STATE)
    if (currentStep.startsWith('conf_claim:')) {
        console.log(`[DEBUG] Handling confirmation for msg: "${lowerMessage}"`);
        if (lowerMessage === 'yes' || lowerMessage === 'confirm') {
            const offerId = currentStep.split(':')[1];
            const claimResult = await claimService.processClaim({ customer_id: freshUser.customer_id, offer_id: offerId, mobile_number: cleanNumber });
            if (claimResult.success) {
                const { offerTitle, vendorName, couponCode, offerDescription, validityEnd, terms, discountValue, discountType } = claimResult;
                const discountStr = discountType?.toLowerCase() === 'flat' ? `₹${discountValue} OFF` : discountType?.toLowerCase() === 'percentage' ? `${discountValue}% OFF` : discountValue;
                
                const successMsg = `✅ *Offer claimed successfully!*\n\n` +
                    `🔥 *${offerTitle}*\n` +
                    `📝 ${offerDescription || 'No description'}\n` +
                    `💰 *Discount:* ${discountStr}\n` +
                    `🏪 *Shop:* ${vendorName}\n` +
                    `🗓️ *Valid Till:* ${validityEnd ? new Date(validityEnd).toLocaleDateString() : 'N/A'}\n\n` +
                    `📜 *Terms:* ${terms || 'Standard T&C apply'}\n\n` +
                    `Thank you for choosing 11za! Visit the shop and enjoy your special offer. 😊`;

                await sendWhatsAppMessage(cleanNumber, successMsg);
            } else {
                await sendWhatsAppMessage(cleanNumber, `⚠️ ${claimResult.message}`);
            }
            await updateUser(cleanNumber, { current_step: 'completed' });
            return res.status(200).send("CLAIM_PROCESSED");
        } else if (lowerMessage === 'no' || lowerMessage === 'cancel') {
            await sendWhatsAppMessage(cleanNumber, "Claim cancelled ❌. Type MENU to browse again.");
            await updateUser(cleanNumber, { current_step: 'completed' });
            return res.status(200).send("CLAIM_CANCELLED");
        } else {
            await sendWhatsAppMessage(cleanNumber, "Please reply with *YES* to confirm your claim, or *NO* to cancel. 😊");
            return res.status(200).send("AWAITING_YES_NO");
        }
    }

    // 5. PICKING OFFER
    if (currentStep.startsWith('pick_off:')) {
        const selectedCategory = currentStep.split(':')[1];
        // 1. Fetch offers for the user's city
        const { data: cityOffers } = await supabase.from("offers").select("*").eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        
        // 2. Fetch vendor IDs for the selected category
        const { data: categoryVendors } = await supabase.from("vendors").select("id").ilike("business_category", `%${selectedCategory}%`);
        const vendorIds = categoryVendors?.map(v => v.id) || [];

        // 3. Filter offers by the matching vendor IDs
        const offers = cityOffers?.filter(o => vendorIds.includes(o.vendor_id)) || [];
        
        let selectedOffer = null;
        if (!isNaN(text.trim())) {
            const index = parseInt(text.trim()) - 1;
            if (index >= 0 && index < offers.length) selectedOffer = offers[index];
        } else {
            selectedOffer = offers.find(o => o.offer_title.trim().toLowerCase() === text.trim().toLowerCase());
        }

        if (!selectedOffer) {
            return res.status(200).send("INVALID_OFFER_SILENT");
        }

        // Check wallet balance before confirming
        const { data: wallet } = await supabase.from("wallets").select("balance").eq("customer_id", freshUser.customer_id).maybeSingle();
        const currentBalance = wallet?.balance || 0;
        const requiredAmount = selectedOffer.wallet_deduction_amount || 0;

        if (currentBalance < requiredAmount) {
            await sendWhatsAppMessage(cleanNumber, `⚠️ *Insufficient Balance*\n\nYour balance: ₹${currentBalance}\nRequired: ₹${requiredAmount}\n\nType WALLET to check your transactions.`);
            await updateUser(cleanNumber, { current_step: 'completed' });
            return res.status(200).send("INSUFFICIENT_BALANCE");
        }

        const discountStr = selectedOffer.discount_type?.toLowerCase() === 'flat' ? `₹${selectedOffer.discount_value} OFF` : selectedOffer.discount_type?.toLowerCase() === 'percentage' ? `${selectedOffer.discount_value}% OFF` : selectedOffer.discount_value;

        await updateUser(cleanNumber, { current_step: `conf_claim:${selectedOffer.id}` });
        
        const confMsg = `📢 *Confirm Claim?*\n\n` +
            `🔥 *${selectedOffer.offer_title}*\n` +
            `📝 ${selectedOffer.offer_description || 'No description'}\n` +
            `💰 *Discount:* ${discountStr}\n` +
            `🗓️ *Valid Till:* ${selectedOffer.validity_end ? new Date(selectedOffer.validity_end).toLocaleDateString() : 'N/A'}\n\n` +
            `📜 *Terms:* ${selectedOffer.terms_conditions || 'Standard T&C apply'}\n` +
            `💸 *Wallet Deduction:* ₹${requiredAmount}\n\n` +
            `Reply *YES* to confirm and get your coupon code! 🚀`;

        await sendWhatsAppMessage(cleanNumber, confMsg);
        return res.status(200).send("CONFIRM_SENT");
    }

    // 6. PICKING CATEGORY
    if (currentStep === 'pick_cat') {
        // 1. Get vendor IDs for active offers in the city
        const { data: cityOffers } = await supabase.from("offers").select("vendor_id").eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const cityVendorIds = [...new Set(cityOffers?.map(o => o.vendor_id) || [])];

        // 2. Get unique categories for those vendors
        const { data: vendors } = await supabase.from("vendors").select("business_category").in("id", cityVendorIds);
        const uniqueCategories = [...new Set(vendors?.map(v => v.business_category?.trim().toUpperCase()).filter(Boolean) || [])].sort();
        let selectedCat = text.trim();

        if (!isNaN(selectedCat)) {
            const index = parseInt(selectedCat) - 1;
            if (index >= 0 && index < uniqueCategories.length) selectedCat = uniqueCategories[index];
        } else {
            const matched = uniqueCategories.find(c => c.toLowerCase() === selectedCat.toLowerCase());
            if (matched) selectedCat = matched;
        }

        const { data: allOffers } = await supabase.from("offers").select("*").eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const { data: matchingVendors } = await supabase.from("vendors").select("id, business_name").ilike("business_category", `%${selectedCat}%`);
        const vendorMap = matchingVendors?.reduce((acc, v) => ({ ...acc, [v.id]: v.business_name }), {}) || {};
        
        const filteredOffers = allOffers?.filter(o => vendorMap[o.vendor_id]).map(o => ({ ...o, vendors: { business_name: vendorMap[o.vendor_id] } })) || [];

        if (filteredOffers.length === 0) {
            await sendWhatsAppMessage(cleanNumber, `Sorry, no offers in "${selectedCat}" found. Type MENU.`);
            await updateUser(cleanNumber, { current_step: 'completed' });
            return res.status(200).send("NO_CATEGORY_OFFERS");
        }

        let reply = `🎁 *${selectedCat} Offers:*\n\n`;
        filteredOffers.forEach((offer, index) => {
            const desc = offer.offer_description || `${offer.discount_value} (${offer.discount_type})`;
            reply += `${index + 1}. *${offer.offer_title}*\n📝 ${desc}\n🏪 ${offer.vendors?.business_name}\n\n`;
        });
        reply += `Reply with offer *number*!`;
        await sendWhatsAppMessage(cleanNumber, reply);
        await updateUser(cleanNumber, { current_step: `pick_off:${selectedCat}` });
        return res.status(200).send("OFFER_LIST_SENT");
    }

    // 7. AWAITING NEW CITY
    if (currentStep === 'wait_new_city') {
        const extractCityPrompt = `User said: "${text}". Extract ONLY the valid Indian city name mentioned. If the input is NOT a real city in India, you MUST reply with exactly the word: INVALID. Return ONLY the city name or INVALID, nothing else. No punctuation.`;
        let newCity = await generateAIResponse(extractCityPrompt, "System");
        newCity = newCity.replace(/[.!?]/g, "").trim();

        if (newCity.toUpperCase() === 'INVALID') {
            await sendWhatsAppMessage(cleanNumber, "Please enter a valid city name in India. 📍");
            return res.status(200).send("INVALID_CITY");
        }

        await updateUser(cleanNumber, { city: newCity, current_step: 'completed' });
        if (freshUser.customer_id) await supabase.from("customers").update({ city: newCity }).eq("id", freshUser.customer_id);
        await sendWhatsAppMessage(cleanNumber, `✅ City updated to *${newCity}*!`);
        
        const { data: activeOffers } = await supabase.from("offers").select(`vendors!inner (business_category)`).eq("offer_status", "Active").ilike("city", `%${newCity}%`);
        if (!activeOffers || activeOffers.length === 0) {
            await sendWhatsAppMessage(cleanNumber, "No offers here yet. Type MENU.");
            return res.status(200).send("NO_OFFERS");
        }
        const categories = [...new Set(activeOffers.map(o => o.vendors?.business_category?.trim().toUpperCase()).filter(Boolean))].sort();
        let reply = `📂 Categories in ${newCity}:\n\n`;
        categories.forEach((cat, i) => { reply += `${i + 1}. ${cat}\n`; });
        reply += `\nReply with category!`;
        await sendWhatsAppMessage(cleanNumber, reply);
        await updateUser(cleanNumber, { current_step: 'pick_cat' });
        return res.status(200).send("CITY_CHANGED");
    }

    // 8. FALLBACK KEYWORDS (OFFERS, WALLET, CLAIMS)
    if (lowerMessage === 'offers' || lowerMessage === '1' || lowerMessage === 'categories' || lowerMessage === '3') {
        const { data: cityOffers } = await supabase.from("offers").select("vendor_id").eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const cityVendorIds = [...new Set(cityOffers?.map(o => o.vendor_id) || [])];

        const { data: vendors } = await supabase.from("vendors").select("business_category").in("id", cityVendorIds);
        const categories = [...new Set(vendors?.map(v => v.business_category?.trim().toUpperCase()).filter(Boolean) || [])].sort();

        if (categories.length === 0) {
            await sendWhatsAppMessage(cleanNumber, `No offers in ${userCity} yet.`);
            return res.status(200).send("NO_OFFERS_START");
        }
        let reply = `📂 *Categories in ${userCity}:*\n\n`;
        categories.forEach((cat, i) => { reply += `${i + 1}. ${cat}\n`; });
        reply += `\nReply with category!`;
        await sendWhatsAppMessage(cleanNumber, reply);
        await updateUser(cleanNumber, { current_step: 'pick_cat' });
        return res.status(200).send("CATEGORIES_START");
    }

    if (lowerMessage === 'wallet' || lowerMessage === '2') {
        const { data: wallet } = await supabase.from("wallets").select("balance").eq("customer_id", freshUser.customer_id).maybeSingle();
        await sendWhatsAppMessage(cleanNumber, `💰 Wallet Balance: ₹${wallet?.balance || 0}`);
        return res.status(200).send("WALLET");
    }

    if (lowerMessage === 'my claims' || lowerMessage === '4') {
        // 1. Check if name or city is missing, if so, restart onboarding
        if (!freshUser.customer_name || !freshUser.city) {
            await sendWhatsAppMessage(cleanNumber, "Welcome to 11za 🎉\nWhat is your name? 😊");
            await updateUser(cleanNumber, { current_step: 'wait_name', onboarding_completed: false });
            return res.status(200).send("ONBOARDING_RESTART");
        }

        const { data: claims, error } = await supabase.from("coupon_claims").select("*").eq("mobile_number", cleanNumber);
        
        let header = `👤 *Name:* ${customerName}\n📍 *City:* ${userCity}\n\n`;

        if (error || !claims || claims.length === 0) {
            await sendWhatsAppMessage(cleanNumber, header + "No claims yet.");
        } else {
            // Fetch offers and vendors manually
            const offerIds = [...new Set(claims.map(c => c.offer_id))];
            const vendorIds = [...new Set(claims.map(c => c.vendor_id))];
            
            let offersMap = {};
            let vendorsMap = {};

            if (offerIds.length > 0) {
                const { data: offersData } = await supabase.from('offers').select('id, offer_title').in('id', offerIds);
                offersData?.forEach(o => offersMap[o.id] = o.offer_title);
            }
            if (vendorIds.length > 0) {
                const { data: vendorsData } = await supabase.from('vendors').select('id, business_name').in('id', vendorIds);
                vendorsData?.forEach(v => vendorsMap[v.id] = v.business_name);
            }

            let reply = header + `🎟 *Your Coupons:*\n\n`;
            claims.forEach((c) => { 
                const offerTitle = offersMap[c.offer_id] || 'Unknown Offer';
                const vendorName = vendorsMap[c.vendor_id] || 'Unknown Vendor';
                reply += `🎁 ${offerTitle}\n🏪 ${vendorName}\nStatus: ${c.claim_status || (c.redeemed ? "Redeemed ✅" : "Claimed 🎟")}\n\n`; 
            });
            await sendWhatsAppMessage(cleanNumber, reply);
        }
        return res.status(200).send("CLAIMS");
    }

    if (lowerMessage === 'help' || lowerMessage === '5' || lowerMessage === 'support') {
        const helpMsg = `🤝 *11za Help & Support* 📞\n\n` +
            `Need assistance? We are here to guide you!\n\n` +
            `1️⃣ *How to Claim Offers:*\n` +
            `Type *MENU* ➡️ select *1* (Offers) or *3* (Categories) ➡️ choose a category ➡️ reply with the offer number to claim.\n\n` +
            `2️⃣ *How to Redeem a Coupon:*\n` +
            `Once claimed, visit the vendor store and show your *Coupon Code* from *My Claims* (Option 4). They will verify and redeem it.\n\n` +
            `3️⃣ *How to check Wallet Balance:*\n` +
            `Type *2* or *WALLET* to check your current balance.\n\n` +
            `4️⃣ *Change your City:*\n` +
            `Type *change city* anytime to view offers in a different location.\n\n` +
            `📧 *Contact Us:*\n` +
            `For any other queries, feel free to write to us at *support@11za.com*.\n\n` +
            `Type *MENU* to return to the main menu. 😊`;
        await sendWhatsAppMessage(cleanNumber, helpMsg);
        return res.status(200).send("HELP_SENT");
    }

    const changeCityKeywords = ['change city', 'update city', 'edit city', 'set city'];
    if (changeCityKeywords.some(k => lowerMessage.includes(k))) {
        await sendWhatsAppMessage(cleanNumber, "Which city would you like? 📍");
        await updateUser(cleanNumber, { current_step: 'wait_new_city' });
        return res.status(200).send("AWAITING_CITY");
    }

    // 9. AI FALLBACK
    // Fetch categories first to provide context to AI
    const { data: cityOfferCats } = await supabase
        .from("offers")
        .select("vendors!inner (business_category)")
        .eq("offer_status", "Active")
        .ilike("city", `%${userCity}%`);

    const availableCats = [...new Set(cityOfferCats?.map(o => o.vendors?.business_category?.trim().toUpperCase()).filter(Boolean) || [])].sort();

    const aiReply = await generateAIResponse(text, customerName, { 
        city: userCity, 
        categories: availableCats 
    });

    await sendWhatsAppMessage(cleanNumber, aiReply || "Type MENU to see options! 😊");
    return res.status(200).send("AI_RESPONSE");

  } catch (err) {
    console.error("CRITICAL ERROR IN WEBHOOK:", err);
    try {
        const entry = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        const rawFrom = String(entry?.from || req.body?.from || req.body?.sender || "");
        if (rawFrom && rawFrom !== "undefined") {
            const cleanNumber = rawFrom.replace("@s.whatsapp.net", "").replace("+", "").trim();
            await sendWhatsAppMessage(cleanNumber, `⚠️ *System Error*\n\nOops! Something went wrong on our end.\nError: ${err.message}\n\nPlease type MENU to restart.`);
        }
    } catch (replyErr) {
        console.error("Failed to send error reply:", replyErr);
    }
    res.status(500).send("Internal Error");
  }
};
