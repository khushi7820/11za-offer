const axios = require("axios");

/**
 * WhatsApp Message Sender using 11za.in API
 * Implementation mirrored from Medistudy Go (Working)
 */
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const authToken = process.env.WHATSAPP_TOKEN?.trim();
    const originWebsite = process.env.ORIGIN_WEBSITE?.trim();
    
    // Using the "sendMessages" endpoint which works for direct text in Medistudy Go
    const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

    const payload = {
      sendto: phoneNumber,
      authToken: authToken,
      originWebsite: originWebsite,
      originWebsites: originWebsite, // Medistudy uses both
      contentType: "text",
      text: message,
    };

    console.log(`Sending 11za WhatsApp message to ${phoneNumber}...`);

    const response = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("11za Response:", response.data);
    return { success: true, data: response.data };
  } catch (err) {
    console.error("11za Send Error:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
};

module.exports = sendWhatsAppMessage;
