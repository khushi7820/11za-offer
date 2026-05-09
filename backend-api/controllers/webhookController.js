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
    console.log("Received Webhook Payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = entry?.from || req.body?.from || req.body?.sender;
    const text = entry?.text?.body || req.body?.content?.text || req.body?.UserResponse || req.body?.text || req.body?.message;

    if (from && text) {
      console.log(`Processing message from ${from}: ${text}`);

      // 0. Reset Command for Testing
      if (text.toLowerCase() === 'reset') {
          await updateUser(from, { onboarding_completed: false, current_step: 'start', customer_name: null });
          await sendWhatsAppMessage(from, "Your state has been reset! Send 'hi' to start onboarding again. 🔄");
          return res.status(200).send("RESET_DONE");
      }

      // 1. Get/Create User from DB
      const user = await getOrCreateUser(from);

      // 2. Onboarding Logic
      if (!user.onboarding_completed) {
          if (user.current_step === 'awaiting_name') {
              const name = text.trim();
              await updateUser(from, { 
                  customer_name: name, 
                  onboarding_completed: true,
                  current_step: 'completed'
              });
              
              const welcomeMsg = `Nice to meet you ${name}! 😊\n\nI can help you with:\n🎁 Offers\n🏪 Nearby vendors\n🎟 Coupons\n💰 Wallet rewards\n\nHow can I help you today?`;
              await sendWhatsAppMessage(from, welcomeMsg);
          } else {
              const askNameMsg = "Hey 👋\nWelcome to 11za!\n\nBefore we continue, may I know your name? 😊";
              await sendWhatsAppMessage(from, askNameMsg);
              await updateUser(from, { current_step: 'awaiting_name' });
          }
      } else {
          const lowerMessage = text.toLowerCase();

          // 3. Keyword Detection for Offers (Direct Supabase Call)
          if (lowerMessage.includes("offer") || lowerMessage.includes("offers")) {
              const { data: offers, error } = await supabase
                  .from("offers")
                  .select("*")
                  .eq("offer_status", "Active");

              if (error) {
                  await sendWhatsAppMessage(from, "Unable to fetch offers right now 😔");
              } else if (!offers || offers.length === 0) {
                  await sendWhatsAppMessage(from, "No active offers available currently 😊");
              } else {
                  let reply = "🎁 *Available Offers:*\n\n";
                  offers.forEach((offer) => {
                      reply += `🏪 *${offer.business_name || "Vendor"}*\n🎁 ${offer.offer_title}\n💸 ${offer.discount_percentage || "Special Offer"}\n\n`;
                  });
                  await sendWhatsAppMessage(from, reply);
              }
              return res.status(200).send("OFFERS_SENT");
          }

          // 4. AI Powered Response for general chat
          const aiReply = await generateAIResponse(text, user.customer_name);
          await sendWhatsAppMessage(from, aiReply);
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Internal Server Error");
  }
};
