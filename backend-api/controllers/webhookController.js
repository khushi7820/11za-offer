const sendWhatsAppMessage = require("../services/whatsappService");

// VERIFY WEBHOOK
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// RECEIVE MESSAGES
exports.receiveMessage = async (req, res) => {
  try {
    console.log(JSON.stringify(req.body, null, 2));

    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;
      console.log("Message from:", from, "Content:", text);

      await sendWhatsAppMessage(
        from,
        "Welcome to 11za 🎉"
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
};
