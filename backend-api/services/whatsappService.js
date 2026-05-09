const axios = require("axios");

const sendWhatsAppMessage = async (to, message) => {
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

    const response = await axios.post(
      process.env.API_URL,
      payload,
      {
        headers: {
          "auth-token": process.env.WHATSAPP_TOKEN,
          "origin": process.env.ORIGIN_WEBSITE,
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
