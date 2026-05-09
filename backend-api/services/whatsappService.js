const axios = require("axios");

const sendWhatsAppMessage = async (to, message) => {
  try {
    console.log(`Sending WhatsApp message to ${to}...`);
    
    const payload = {
      to: to,
      template_name: "welcome_message", // Ensure this exists in 11za dashboard
      language: "en",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: message }]
        }
      ]
    };

    const token = process.env.WHATSAPP_TOKEN?.trim();
    const origin = process.env.ORIGIN_WEBSITE?.trim();

    console.log("Diagnostic - API URL:", process.env.API_URL);
    console.log("Diagnostic - Origin (Trimmed):", origin);

    const response = await axios.post(
      process.env.API_URL,
      payload,
      {
        headers: {
          "authToken": token,
          "auth-token": token,
          "originWebsite": origin,
          "origin": origin,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("WhatsApp message sent successfully:", response.data);
  } catch (err) {
    console.error("WhatsApp Send Error:", err.response?.data || err.message);
  }
};

module.exports = sendWhatsAppMessage;
