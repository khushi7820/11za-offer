const axios = require("axios");

const sendWhatsAppMessage = async (to, message) => {
  try {
    await axios.post(
      process.env.API_URL,
      {
        to,
        // Note: 11za.in usually requires a template name and components
        // For now, I'm setting a generic structure. We may need to adjust this.
        template_name: "welcome_message", 
        language: "en",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: message }]
          }
        ]
      },
      {
        headers: {
          "auth-token": process.env.WHATSAPP_TOKEN,
          "origin": process.env.ORIGIN_WEBSITE,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("WhatsApp message sent successfully");
  } catch (err) {
    console.log("WhatsApp Send Error:", err.response?.data || err.message);
  }
};

module.exports = sendWhatsAppMessage;
