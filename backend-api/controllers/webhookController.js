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
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = entry?.from || req.body?.from || req.body?.sender;
    const text = entry?.text?.body || req.body?.content?.text || req.body?.UserResponse || req.body?.text || req.body?.message;

    if (!from || !text) {
        return res.status(200).send("NO_MESSAGE");
    }

    const lowerMessage = text.toLowerCase().trim();
    const user = await getOrCreateUser(from);

    // 0. Reset Command for Testing
    if (lowerMessage === 'reset') {
        await updateUser(from, { onboarding_completed: false, current_step: 'awaiting_name', customer_name: null, city: null });
        await sendWhatsAppMessage(from, "Welcome to 11za 🎉\nWhat is your name? 😊");
        return res.status(200).send("RESET_DONE");
    }

    // 1. Onboarding Flow
    if (!user.onboarding_completed) {
        if (user.current_step === 'awaiting_name') {
            const name = text.trim();
            await updateUser(from, { 
                customer_name: name, 
                current_step: 'awaiting_city'
            });
            await sendWhatsAppMessage(from, "Which city are you from? 📍");
        } else if (user.current_step === 'awaiting_city') {
            const city = text.trim();

            // 1. Create Customer record
            const { data: customer, error: customerError } = await supabase
                .from("customers")
                .insert([{
                    customer_name: user.customer_name,
                    mobile_number: from,
                    city: city
                }])
                .select()
                .single();

            if (customerError) {
                console.error("Customer Creation Error:", customerError);
                return await sendWhatsAppMessage(from, "Something went wrong. Please try again later. 😔");
            }

            // 2. Create Wallet with welcome bonus transaction
            await walletService.addTransaction({
                customer_id: customer.id,
                amount: 100,
                type: 'welcome_bonus',
                description: 'Welcome Bonus 🎉'
            });

            // 3. Link WhatsApp user and complete onboarding
            await updateUser(from, { 
                city: city,
                customer_id: customer.id,
                onboarding_completed: true,
                current_step: 'completed'
            });

            await sendWhatsAppMessage(from, `Awesome 😊\nYou'll now receive offers for ${city} only 🎁\n\n🎁 *Welcome Gift!* ₹100 has been added to your wallet! 💰`);
        } else {
            // Initial state
            await sendWhatsAppMessage(from, "Welcome to 11za 🎉\nWhat is your name? 😊");
            await updateUser(from, { current_step: 'awaiting_name' });
        }
        return res.status(200).send("ONBOARDING_STEP");
    }

    // --- STATE HANDLING (PRIORITY) ---
    const menuKeywords = ['menu', 'hi', 'hello', 'reset', 'hey', 'hii', 'help', 'options', 'start'];
    const isMenuKeyword = menuKeywords.includes(lowerMessage);
    const userCity = (user.city || '').trim();
    
    console.log(`[STATE CHECK] Phone: ${from} | Msg: "${text}" | Initial State: ${user.current_step}`);

    // Handle Greetings/Reset first
    if (isMenuKeyword) {
        if (lowerMessage === 'reset') {
            await updateUser(from, { onboarding_completed: false, current_step: 'awaiting_name', customer_name: null, city: null });
            await sendWhatsAppMessage(from, "Welcome to 11za 🎉\nWhat is your name? 😊");
            return res.status(200).send("RESET_DONE");
        }
        const menuMsg = `🏠 11za Menu\n\n1️⃣ Offers\n2️⃣ Wallet\n3️⃣ Categories\n4️⃣ My Claims\n5️⃣ Help\n\n📍 Type "change city" to update your location.`;
        await sendWhatsAppMessage(from, menuMsg);
        await updateUser(from, { current_step: 'completed' });
        return res.status(200).send("MENU_SENT");
    }

    // RE-FETCH FRESH STATE to prevent race conditions during rapid messages
    const freshUser = await getOrCreateUser(from);
    const currentStep = freshUser.current_step || 'completed';

    if (currentStep === 'awaiting_new_city') {
        const newCity = text.trim();
        await updateUser(from, { city: newCity, current_step: 'completed' });
        if (freshUser.customer_id) {
            await supabase
                .from("customers")
                .update({ city: newCity })
                .eq("id", freshUser.customer_id);
        }

        await sendWhatsAppMessage(from, `✅ City updated to *${newCity}*! Fetching the best deals for you... 🎁`);
        
        // 3. Immediately show offers for the new city
        const { data: activeOffers } = await supabase
            .from("offers")
            .select(`vendors!inner (business_category)`)
            .eq("offer_status", "Active")
            .ilike("city", `%${newCity}%`);

        if (!activeOffers || activeOffers.length === 0) {
            await sendWhatsAppMessage(from, `Currently, there are no active offers in ${newCity} 😊. Type MENU to see other options.`);
            return res.status(200).send("NO_OFFERS_NEW_CITY");
        }

        const uniqueCategories = [...new Set(activeOffers.map(o => o.vendors?.business_category?.trim().toUpperCase()).filter(Boolean))].sort();
        let reply = `📂 *Available Categories in ${newCity}:*\n\n`;
        uniqueCategories.forEach((cat, index) => { 
            reply += `${index + 1}. ${cat}\n`; 
        });
        reply += `\nReply with category name or number!`;
        
        await sendWhatsAppMessage(from, reply);
        await updateUser(from, { current_step: 'picking_category' });
        return res.status(200).send("OFFERS_SHOWN_AFTER_CITY_CHANGE");

    } else if (currentStep.startsWith('confirming_claim:')) {
        // 1. Handle Claim Confirmation (HIGHEST PRIORITY)
        console.log(`[CONFIRMING_CLAIM] Processing: "${lowerMessage}" for state ${currentStep}`);
        
        if (lowerMessage === 'yes' || lowerMessage === 'confirm') {
            const offerId = currentStep.split(':')[1];
            
            const claimResult = await claimService.processClaim({
                customer_id: freshUser.customer_id,
                offer_id: offerId,
                mobile_number: from
            });

            if (claimResult.success) {
                const successMsg = `✅ *Offer claimed successfully!*\n\n🎁 Offer: ${claimResult.offerTitle}\n🏪 Shop: ${claimResult.vendorName}\n🎟 Code: *${claimResult.couponCode}*\n\nVisit the shop and show your mobile number to redeem this offer. 😊`;
                await sendWhatsAppMessage(from, successMsg);
                await updateUser(from, { current_step: 'completed' });
                return res.status(200).send("CLAIM_SUCCESS");
            } else {
                await sendWhatsAppMessage(from, `⚠️ ${claimResult.message}`);
                await updateUser(from, { current_step: 'completed' });
                return res.status(200).send("CLAIM_FAILED");
            }
        } else {
            await sendWhatsAppMessage(from, "Claim cancelled ❌. Type MENU to browse again.");
            await updateUser(from, { current_step: 'completed' });
            return res.status(200).send("CLAIM_CANCELLED");
        }

    } else if (currentStep.startsWith('picking_offer:')) {
        console.log(`[PICKING_OFFER] User is picking offer for category: ${currentStep.split(':')[1]}`);
        const selectedCategory = currentStep.split(':')[1];
        const { data: allOffers } = await supabase.from("offers").select(`id, offer_title, wallet_deduction_amount, vendors!inner (business_category)`).eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const offers = allOffers?.filter(o => o.vendors?.business_category?.trim().toLowerCase() === selectedCategory.toLowerCase()) || [];
        
        let selectedOffer = null;
        if (!isNaN(text.trim())) {
            const index = parseInt(text.trim()) - 1;
            if (index >= 0 && index < offers.length) selectedOffer = offers[index];
        } else {
            selectedOffer = offers.find(o => o.offer_title.trim().toLowerCase() === text.trim().toLowerCase());
        }

        if (!selectedOffer) {
            await sendWhatsAppMessage(from, "Please reply with a valid offer number or name from the list above 👆\n(Or type MENU to go back)");
            return res.status(200).send("INVALID_SELECTION");
        }

        await updateUser(from, { current_step: `confirming_claim:${selectedOffer.id}` });
        await sendWhatsAppMessage(from, `📢 *Confirm Claim?*\n\n🎁 Offer: ${selectedOffer.offer_title}\n💰 Wallet Deduction: ₹${selectedOffer.wallet_deduction_amount}\n\nReply *YES* to confirm!`);
        return res.status(200).send("CONFIRM_CLAIM_SENT");

    } else if (currentStep === 'picking_category') {
        const { data: activeOffers } = await supabase.from("offers").select("vendors!inner(business_category)").eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const uniqueCategories = [...new Set(activeOffers?.map(o => o.vendors?.business_category?.trim().toUpperCase()).filter(Boolean) || [])].sort();
        let selectedCategory = text.trim();

        if (!isNaN(selectedCategory)) {
            const index = parseInt(selectedCategory) - 1;
            if (index >= 0 && index < uniqueCategories.length) selectedCategory = uniqueCategories[index];
        } else {
            const matched = uniqueCategories.find(c => c.toLowerCase() === selectedCategory.toLowerCase());
            if (matched) selectedCategory = matched;
        }

        const { data: allOffers } = await supabase.from("offers").select(`id, offer_title, offer_description, discount_type, discount_value, vendors!inner(business_name, business_category)`).eq("offer_status", "Active").ilike("city", `%${userCity}%`);
        const offers = allOffers?.filter(o => o.vendors?.business_category?.trim().toLowerCase() === selectedCategory.toLowerCase()) || [];

        if (offers.length === 0) {
            await sendWhatsAppMessage(from, `Sorry, I couldn't find offers for "${selectedCategory}" in ${userCity} 😊\nType MENU to see other categories.`);
            await updateUser(from, { current_step: 'completed' });
        } else {
            let reply = `🎁 *${selectedCategory} Offers:*\n\n`;
            offers.forEach((offer, index) => {
                const desc = offer.offer_description ? `📝 ${offer.offer_description}` : `📝 ${offer.discount_value || 'Special Offer'} (${offer.discount_type || 'Discount'})`;
                reply += `${index + 1}. *${offer.offer_title}*\n${desc}\n🏪 ${offer.vendors?.business_name || ''}\n\n`;
            });
            reply += `Reply with the offer *number* or *name*!`;
            await sendWhatsAppMessage(from, reply);
            await updateUser(from, { current_step: `picking_offer:${selectedCategory}` });
        }
        return res.status(200).send("OFFER_LIST_SENT");

    } else {
        // Fallbacks
        if (lowerMessage === 'offers' || lowerMessage === '1' || lowerMessage === 'categories' || lowerMessage === '3') {
            const { data: activeOffers } = await supabase.from("offers").select(`vendors!inner (business_category)`).eq("offer_status", "Active").ilike("city", `%${userCity}%`);
            if (!activeOffers || activeOffers.length === 0) {
                await sendWhatsAppMessage(from, `No offers available in ${userCity} currently 😊`);
                return res.status(200).send("NO_OFFERS");
            }
            const uniqueCategories = [...new Set(activeOffers.map(o => o.vendors?.business_category?.trim().toUpperCase()).filter(Boolean))].sort();
            let reply = `📂 *Available Categories in ${userCity}:*\n\n`;
            uniqueCategories.forEach((cat, index) => { reply += `${index + 1}. ${cat}\n`; });
            reply += `\nReply with category name or number!`;
            await sendWhatsAppMessage(from, reply);
            await updateUser(from, { current_step: 'picking_category' });
            return res.status(200).send("CATEGORIES_SENT");
        }

        // Wallet Flow
        if (lowerMessage === 'wallet' || lowerMessage === '2') {
            const { data: wallet } = await supabase.from("wallets").select("balance").eq("customer_id", freshUser.customer_id).maybeSingle();
            const balance = wallet ? wallet.balance : 0;
            await sendWhatsAppMessage(from, `💰 Wallet Balance: ₹${balance}`);
            return res.status(200).send("WALLET_SENT");
        }

        // My Claims Flow
        if (lowerMessage === 'my claims' || lowerMessage === 'my coupons' || lowerMessage === '4') {
            const { data: claims } = await supabase.from("coupon_claims").select("*, offers(offer_title, vendors(business_name))").eq("mobile_number", from);
            if (!claims || claims.length === 0) {
                await sendWhatsAppMessage(from, "You haven't claimed any coupons yet 😊");
            } else {
                let reply = `🎟 *My Claimed Coupons:*\n\n`;
                claims.forEach((claim) => { reply += `🎁 ${claim.offers?.offer_title}\n🏪 ${claim.offers?.vendors?.business_name}\nStatus: ${claim.redeemed ? "Redeemed ✅" : "Claimed 🎟"}\n\n`; });
                await sendWhatsAppMessage(from, reply);
            }
            return res.status(200).send("MY_CLAIMS_SENT");
        }

        // Change City Flow (Manual Trigger)
        const changeCityKeywords = ['change city', 'update city', 'edit city', 'change ciity', 'change citi', 'set city'];
        if (changeCityKeywords.some(k => lowerMessage.includes(k))) {
            await sendWhatsAppMessage(from, "Which city would you like to see offers for? 📍");
            await updateUser(from, { current_step: 'awaiting_new_city' });
            return res.status(200).send("AWAITING_NEW_CITY");
        }
    }

    // Handle Help or generic input
    const aiReply = await generateAIResponse(text, user.customer_name);
    if (!aiReply || aiReply.length < 5) {
        await sendWhatsAppMessage(from, "I'm sorry, I didn't quite get that. Type MENU to see options! 😊");
    } else {
        await sendWhatsAppMessage(from, aiReply);
    }
    return res.status(200).send("GENERIC_RESPONSE");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Internal Server Error");
  }
};
