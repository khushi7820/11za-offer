const axios = require("axios");

/**
 * WhatsApp Message Sender for 11za-offer
 * Direct Message Implementation (No Template Required)
 */
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const authToken = process.env.WHATSAPP_TOKEN?.trim();
    const originWebsite = process.env.ORIGIN_WEBSITE?.trim();
    
    // Direct message endpoint
    const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

    const payload = {
      sendto: phoneNumber,
      authToken: authToken,
      originWebsite: originWebsite,
      originWebsites: originWebsite,
      contentType: "text",
      text: message,
    };

    console.log(`Sending Direct WhatsApp message to ${phoneNumber}...`);

    const response = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      }
    });

    console.log("11za Direct Send Response:", response.data);
  } catch (err) {
    console.error("11za Direct Send Error:", err.response?.data || err.message);
  }
};

module.exports = sendWhatsAppMessage;
