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

    const payload = {
      authToken: token,
      originWebsite: origin,
      to: to,
      template_name: "welcome_message", 
      language: "en",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: message }]
        }
      ]
    };

    console.log("Diagnostic - Sending Payload with Credentials in Body");

    const response = await axios.post(
      process.env.API_URL,
      payload,
      {
        headers: {
          "authToken": token,
          "originWebsite": origin,
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
