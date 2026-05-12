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

            // 2. Create Wallet with welcome balance
            await supabase
                .from("wallets")
                .insert([{
                    customer_id: customer.id,
                    balance: 100
                }]);

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

    // 2. Main Menu
    if (['menu', 'hi', 'hello', 'reset'].includes(lowerMessage)) {
        if (lowerMessage === 'reset') {
            await updateUser(from, { onboarding_completed: false, current_step: 'awaiting_name', customer_name: null, city: null });
            await sendWhatsAppMessage(from, "Welcome to 11za 🎉\nWhat is your name? 😊");
            return res.status(200).send("RESET_DONE");
        }
        const menuMsg = `🏠 11za Menu\n\n1️⃣ Offers\n2️⃣ Wallet\n3️⃣ Categories\n4️⃣ My Claims\n5️⃣ Help`;
        await sendWhatsAppMessage(from, menuMsg);
        await updateUser(from, { current_step: 'completed' });
        return res.status(200).send("MENU_SENT");
    }

    // 3. Offers Flow (Start)
    if (lowerMessage === 'offers' || lowerMessage === '1' || lowerMessage === 'categories' || lowerMessage === '3') {
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
            await sendWhatsAppMessage(from, `No offers available in ${user.city} currently 😊`);
            return res.status(200).send("NO_OFFERS");
        }

        const uniqueCategories = [...new Set(activeOffers.map(o => o.vendors?.business_category).filter(Boolean))];
        let reply = `📂 *Available Categories in ${user.city}:*\n\n`;
        uniqueCategories.forEach((cat, index) => {
            reply += `${index + 1}️⃣ ${cat}\n`;
        });
        reply += `\nReply with category name or number!`;
        await sendWhatsAppMessage(from, reply);
        await updateUser(from, { current_step: 'picking_category' });
        return res.status(200).send("CATEGORIES_SENT");
    }

    // 4. Wallet Flow
    if (lowerMessage === 'wallet' || lowerMessage === '2') {
        const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("customer_id", user.customer_id)
            .maybeSingle();

        const balance = wallet ? wallet.balance : 0;
        await sendWhatsAppMessage(from, `💰 Wallet Balance: ₹${balance}`);
        return res.status(200).send("WALLET_SENT");
    }

    // 5. My Claims Flow
    if (lowerMessage === 'my claims' || lowerMessage === 'my coupons' || lowerMessage === '4') {
        const { data: claims, error } = await supabase
            .from("coupon_claims")
            .select("*, offers(offer_title, vendors(business_name))")
            .eq("mobile_number", from);

        if (error || !claims || claims.length === 0) {
            await sendWhatsAppMessage(from, "You haven't claimed any coupons yet 😊");
        } else {
            let reply = `🎟 *My Claimed Coupons:*\n\n`;
            claims.forEach((claim) => {
                reply += `🎁 ${claim.offers?.offer_title}\n🏪 ${claim.offers?.vendors?.business_name}\nStatus: ${claim.redeemed ? "Redeemed ✅" : "Claimed 🎟"}\n\n`;
            });
            await sendWhatsAppMessage(from, reply);
        }
        return res.status(200).send("MY_CLAIMS_SENT");
    }

    // 6. Handle Picking Category
    if (user.current_step === 'picking_category') {
        const { data: activeOffers } = await supabase
            .from("offers")
            .select("vendors!inner(business_category)")
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`);
        
        const uniqueCategories = [...new Set(activeOffers?.map(o => o.vendors?.business_category).filter(Boolean) || [])];
        let selectedCategory = text.trim();

        if (!isNaN(selectedCategory)) {
            const index = parseInt(selectedCategory) - 1;
            if (index >= 0 && index < uniqueCategories.length) {
                selectedCategory = uniqueCategories[index];
            }
        }

        const { data: offers, error } = await supabase
            .from("offers")
            .select(`
                id,
                offer_title,
                vendors!inner (
                    business_name,
                    business_category
                )
            `)
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`)
            .ilike("vendors.business_category", `%${selectedCategory}%`);

        if (error || !offers || offers.length === 0) {
            await sendWhatsAppMessage(from, `No offers found in ${selectedCategory} 😊`);
            await updateUser(from, { current_step: 'completed' });
        } else {
            let reply = `🎁 *${selectedCategory} Offers:*\n\n`;
            offers.forEach((offer, index) => {
                reply += `${index + 1}️⃣ ${offer.offer_title}\n🏪 ${offer.vendors.business_name}\n\n`;
            });
            reply += `Reply with the offer number to select!`;
            await sendWhatsAppMessage(from, reply);
            // We'll store the category context in the step name to avoid DB changes for now
            await updateUser(from, { current_step: `picking_offer:${selectedCategory}` });
        }
        return res.status(200).send("OFFER_LIST_SENT");
    }

    // 7. Handle Picking Offer
    if (user.current_step.startsWith('picking_offer:')) {
        const selectedCategory = user.current_step.split(':')[1];
        const { data: offers } = await supabase
            .from("offers")
            .select("id, offer_title, wallet_deduction_amount")
            .eq("offer_status", "Active")
            .ilike("city", `%${user.city}%`)
            .ilike("vendors!inner.business_category", `%${selectedCategory}%`);

        const index = parseInt(text.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= offers.length) {
            return await sendWhatsAppMessage(from, "Please reply with a valid offer number from the list above 👆");
        }

        const selectedOffer = offers[index];
        const reply = `📢 *Confirm Claim?*\n\n🎁 Offer: ${selectedOffer.offer_title}\n💰 Wallet Deduction: ₹${selectedOffer.wallet_deduction_amount}\n\nReply *YES* to confirm!`;
        await sendWhatsAppMessage(from, reply);
        await updateUser(from, { current_step: `confirming_claim:${selectedOffer.id}` });
        return res.status(200).send("CONFIRM_CLAIM_SENT");
    }

    // 8. Handle Confirming Claim
    if (user.current_step.startsWith('confirming_claim:')) {
        if (lowerMessage !== 'yes') {
            await sendWhatsAppMessage(from, "Claim cancelled. Type MENU to start over 😊");
            await updateUser(from, { current_step: 'completed' });
            return res.status(200).send("CLAIM_CANCELLED");
        }

        const offerId = user.current_step.split(':')[1];
        
        // Fetch Offer
        const { data: offer } = await supabase
            .from("offers")
            .select("*")
            .eq("id", offerId)
            .single();

        // Duplicate Check
        const { data: existingClaim } = await supabase
            .from("coupon_claims")
            .select("*")
            .eq("mobile_number", from)
            .eq("offer_id", offerId)
            .maybeSingle();

        if (existingClaim) {
            await sendWhatsAppMessage(from, "⚠️ You have already claimed this offer 😊");
            await updateUser(from, { current_step: 'completed' });
            return res.status(200).send("ALREADY_CLAIMED");
        }

        // Wallet Check
        const { data: wallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("customer_id", user.customer_id)
            .single();

        const deduction = offer.wallet_deduction_amount || 0;
        if (wallet.balance < deduction) {
            await sendWhatsAppMessage(from, `⚠️ Insufficient wallet balance.\nBalance: ₹${wallet.balance}\nRequired: ₹${deduction}`);
            await updateUser(from, { current_step: 'completed' });
            return res.status(200).send("INSUFFICIENT_BALANCE");
        }

        // Execute Claim
        const couponCode = "11ZA" + Math.floor(100000 + Math.random() * 900000);
        
        if (deduction > 0) {
            await supabase
                .from("wallets")
                .update({ balance: wallet.balance - deduction })
                .eq("customer_id", user.customer_id);
            
            // Record Wallet Transaction
            await supabase.from("wallet_transactions").insert([{
                customer_id: user.customer_id,
                amount: deduction,
                type: 'debit',
                description: `Claimed: ${offer.offer_title}`
            }]);
        }

        await supabase.from("coupon_claims").insert([{
            mobile_number: from,
            offer_id: offer.id,
            coupon_code: couponCode,
            redeemed: false,
            claim_status: 'pending'
        }]);

        await sendWhatsAppMessage(from, `✅ *Offer claimed successfully!*\n\n₹${deduction} has been deducted from your wallet.\n\nVisit the shop and show your mobile number to redeem this offer. 😊`);
        await updateUser(from, { current_step: 'completed' });
        return res.status(200).send("CLAIM_SUCCESS");
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
