const axios = require("axios");

/**
 * WhatsApp Message Sender for 11za-offer project
 * Uses the correct 11za.in field names: sendto, authToken, templateId
 */
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const authToken = process.env.WHATSAPP_TOKEN?.trim();
    const originWebsite = process.env.ORIGIN_WEBSITE?.trim();
    const API_URL = process.env.API_URL || "https://api.11za.in/apis/template/sendTemplate";

    const payload = {
      sendto: phoneNumber,
      authToken: authToken,
      originWebsite: originWebsite,
      originWebsites: originWebsite, // 11za often expects plural too
      templateId: "welcome_message", // The ID from your 11za dashboard
      parameters: {
          "1": message // 11za templates usually use numbered parameters
      }
    };

    console.log(`Sending Template via 11za to ${phoneNumber}...`);

    const response = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "authToken": authToken,
        "originWebsite": originWebsite
      }
    });

    console.log("11za Response:", response.data);
  } catch (err) {
    console.error("11za Send Error:", err.response?.data || err.message);
  }
};

module.exports = sendWhatsAppMessage;
