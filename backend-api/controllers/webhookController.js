const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getOrCreateUser, updateUser } = require("../services/userStateService");
const { generateAIResponse } = require("../services/aiService");

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
              // Save the name
              const name = text.trim();
              await updateUser(from, { 
                  customer_name: name, 
                  onboarding_completed: true,
                  current_step: 'completed'
              });
              await sendWhatsAppMessage(from, `Nice to meet you ${name}! 😊 Welcome to 11za. How can I help you today?`);
          } else {
              // Ask for name
              await sendWhatsAppMessage(from, "Welcome to 11za! 🎉 Before we continue, please tell me your name.");
              await updateUser(from, { current_step: 'awaiting_name' });
          }
      } else {
          // 3. AI Powered Response for Onboarded Users
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
