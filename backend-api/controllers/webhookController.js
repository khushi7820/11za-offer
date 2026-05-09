const sendWhatsAppMessage = require("../services/whatsappService");

// VERIFY WEBHOOK (Common for Meta, optional for others)
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }
  // Fallback for simple GET verification from other providers
  if (req.query["verify"] === "true") {
      return res.status(200).send("Verified");
  }
  return res.sendStatus(403);
};

// RECEIVE MESSAGES
exports.receiveMessage = async (req, res) => {
  try {
    // CRITICAL: Log the body to see exactly what 11za sends
    console.log("Received Webhook Payload:", JSON.stringify(req.body, null, 2));

    // Support for both Meta and generic structures (like 11za)
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = entry?.from || req.body?.from || req.body?.sender;
    const text = entry?.text?.body || req.body?.text || req.body?.message;

    if (from && text) {
      console.log("Processing message from:", from, "Content:", text);

      // Simple echo response for testing
      await sendWhatsAppMessage(
        from,
        `Welcome to 11za! We received your message: "${text}"`
      );
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.sendStatus(500);
  }
};
