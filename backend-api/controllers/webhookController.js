const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getOrCreateUser, updateUser } = require("../services/userStateService");
const { generateAIResponse } = require("../services/aiService");
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
            await updateUser(from, { 
                city: city, 
                onboarding_completed: true,
                current_step: 'completed'
            });
            await sendWhatsAppMessage(from, `Awesome 😊\nYou'll now receive offers for ${city} only 🎁`);
        } else {
            // Initial state
            await sendWhatsAppMessage(from, "Welcome to 11za 🎉\nWhat is your name? 😊");
            await updateUser(from, { current_step: 'awaiting_name' });
        }
        return res.status(200).send("ONBOARDING_STEP");
    }

    // 2. Main Menu
    if (['menu', 'hi', 'hello'].includes(lowerMessage)) {
        const menuMsg = `🏠 11za Menu\n\n1️⃣ Offers\n2️⃣ Categories\n3️⃣ Wallet\n4️⃣ My Coupons\n5️⃣ Help`;
        await sendWhatsAppMessage(from, menuMsg);
        return res.status(200).send("MENU_SENT");
    }

    // 3. Offers Flow
    if (lowerMessage === 'offers' || lowerMessage === '1') {
        const { data: offers, error } = await supabase
            .from("offers")
            .select(`
                *,
                vendors (
                    owner_name,
                    business_name
                )
            `)
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`);

        if (error || !offers || offers.length === 0) {
            await sendWhatsAppMessage(from, "No active offers available currently 😊");
        } else {
            let reply = `🎁 Offers in ${user.city}\n\n`;
            offers.forEach((offer) => {
                reply += `🏪 ${offer.vendors?.business_name || offer.vendors?.owner_name || "Vendor"}\n🎁 ${offer.offer_title}\n🆔 ${offer.offer_code}\n\n`;
            });
            reply += "Type: *claim <CODE>* to get your coupon!";
            await sendWhatsAppMessage(from, reply);
        }
        return res.status(200).send("OFFERS_SENT");
    }

    // 4. Wallet Flow
    if (lowerMessage === 'wallet' || lowerMessage === '3') {
        const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("customer_id", user.customer_id)
            .maybeSingle();

        const balance = wallet ? wallet.balance : 0;
        await sendWhatsAppMessage(from, `💰 Wallet Balance: ₹${balance}`);
        return res.status(200).send("WALLET_SENT");
    }

    // 5. My Coupons Flow
    if (lowerMessage === 'my coupons' || lowerMessage === '4') {
        const { data: claims, error } = await supabase
            .from("coupon_claims")
            .select(`
                coupon_code,
                offers (
                    offer_title,
                    vendors (business_name)
                )
            `)
            .eq("mobile_number", from);

        if (error || !claims || claims.length === 0) {
            await sendWhatsAppMessage(from, "You haven't claimed any coupons yet 😊");
        } else {
            let reply = `🎟 *My Claimed Coupons:*\n\n`;
            claims.forEach((claim) => {
                reply += `🎁 ${claim.offers?.offer_title}\n🎟 Code: *${claim.coupon_code}*\n🏪 ${claim.offers?.vendors?.business_name || "Vendor"}\n\n`;
            });
            await sendWhatsAppMessage(from, reply);
        }
        return res.status(200).send("MY_COUPONS_SENT");
    }

    // 6. Claim Flow
    if (lowerMessage.startsWith("claim")) {
        const code = lowerMessage.replace("claim", "").trim().toUpperCase();
        if (!code) {
            return await sendWhatsAppMessage(from, "Please specify the offer code. E.g., 'claim OFFER101' 😊");
        }

        // Fetch Offer
        const { data: offer, error: findError } = await supabase
            .from("offers")
            .select("*")
            .eq("offer_code", code)
            .eq("offer_status", "Active")
            .maybeSingle();

        if (findError || !offer) {
            return await sendWhatsAppMessage(from, "Invalid offer code 😔");
        }

        // Check Duplicate
        const { data: existingClaim } = await supabase
            .from("coupon_claims")
            .select("*")
            .eq("mobile_number", from)
            .eq("offer_id", offer.id)
            .maybeSingle();

        if (existingClaim) {
            return await sendWhatsAppMessage(from, "⚠️ You already claimed this offer 😊");
        }

        // Check Wallet
        const { data: wallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("customer_id", user.customer_id)
            .maybeSingle();

        const balance = wallet ? wallet.balance : 0;
        const deduction = offer.wallet_deduction_amount || 0;

        if (balance < deduction) {
            return await sendWhatsAppMessage(from, `⚠️ Insufficient wallet balance.\nBalance: ₹${balance}\nRequired: ₹${deduction}`);
        }

        // Generate Coupon
        const couponCode = "11ZA" + Math.floor(1000 + Math.random() * 9000);

        // Transaction: Deduct wallet and save claim
        if (deduction > 0) {
            await supabase
                .from("wallets")
                .update({ balance: balance - deduction })
                .eq("customer_id", user.customer_id);
        }

        const { error: claimError } = await supabase
            .from("coupon_claims")
            .insert([{
                mobile_number: from,
                offer_id: offer.id,
                coupon_code: couponCode
            }]);

        if (claimError) {
            return await sendWhatsAppMessage(from, "Error claiming coupon. Please try again 😔");
        }

        const claimReply = `✅ Coupon Claimed\n\n🎟 Coupon Code:\n${couponCode}\n\nShow this code to vendor 😊`;
        await sendWhatsAppMessage(from, claimReply);
        return res.status(200).send("CLAIM_SUCCESS");
    }

    // 7. Help Flow
    if (lowerMessage === 'help' || lowerMessage === '5') {
        await sendWhatsAppMessage(from, "Our support team will assist you shortly 😊");
        return res.status(200).send("HELP_SENT");
    }


    // 8. Categories Flow
    if (lowerMessage === 'categories' || lowerMessage === '2') {
        // Fetch vendors that have active offers in user's city
        const { data: activeOffers, error } = await supabase
            .from("offers")
            .select(`
                vendors!inner (
                    business_category
                )
            `)
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`);

        if (error || !activeOffers || activeOffers.length === 0) {
            await sendWhatsAppMessage(from, `No categories available in *${user.city}* currently 😊`);
        } else {
            const uniqueCategories = [...new Set(activeOffers.map(o => o.vendors?.business_category).filter(Boolean))];
            let reply = `📂 *Available Categories in ${user.city}:*\n\n`;
            uniqueCategories.forEach((cat, index) => {
                reply += `${index + 1}️⃣ ${cat}\n`;
            });
            reply += `\nReply with category name or number!`;
            await sendWhatsAppMessage(from, reply);
            await updateUser(from, { current_step: 'picking_category' });
        }
        return res.status(200).send("CATEGORIES_SENT");
    }

    // 8.1 Handle Category Selection
    if (user.current_step === 'picking_category') {
        let selectedCategory = text.trim();
        
        // Re-fetch unique categories for the city to map the number correctly
        const { data: activeOffers } = await supabase
            .from("offers")
            .select("vendors!inner(business_category)")
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`);
        
        const uniqueCategories = [...new Set(activeOffers?.map(o => o.vendors?.business_category).filter(Boolean) || [])];

        if (!isNaN(selectedCategory)) {
            const index = parseInt(selectedCategory) - 1;
            if (index >= 0 && index < uniqueCategories.length) {
                selectedCategory = uniqueCategories[index];
            }
        }

        const { data: offers, error } = await supabase
            .from("offers")
            .select(`
                *,
                vendors!inner (
                    owner_name,
                    business_name,
                    business_category
                )
            `)
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`)
            .ilike("vendors.business_category", `%${selectedCategory}%`);

        if (error || !offers || offers.length === 0) {
            await sendWhatsAppMessage(from, `No offers found in *${selectedCategory}* 😊`);
        } else {
            let reply = `🎁 *${selectedCategory} Offers in ${user.city}:*\n\n`;
            offers.forEach((offer) => {
                reply += `🏪 ${offer.vendors?.business_name || offer.vendors?.owner_name || "Vendor"}\n🎁 ${offer.offer_title}\n🆔 ${offer.offer_code}\n\n`;
            });
            reply += "Type: *claim <CODE>* to get your coupon!";
            await sendWhatsAppMessage(from, reply);
        }
        await updateUser(from, { current_step: 'completed' });
        return res.status(200).send("CATEGORY_OFFERS_SENT");
    }
    const aiReply = await generateAIResponse(text, user.customer_name);
    if (!aiReply || aiReply.length < 5) {
        // Fallback to unknown message if AI fails or gives too short response
        await sendWhatsAppMessage(from, "Sorry 😊\nI didn’t understand that.\n\nType:\noffers\nwallet\nmy coupons\nmenu");
    } else {
        await sendWhatsAppMessage(from, aiReply);
    }
    
    res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Internal Server Error");
  }
};
