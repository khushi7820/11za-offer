const axios = require("axios");

/**
 * Generate AI Response using Gemini (Direct V1 API Call)
 */
async function generateAIResponse(message, userName = "User") {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        console.log(`Calling Gemini V1 API for ${userName}...`);

        const payload = {
            contents: [{
                parts: [{
                    text: `You are a helpful assistant for 11za offers. User name: ${userName}. User says: ${message}. Keep it very short and use emojis.`
                }]
            }]
        };

        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("Gemini V1 Reply:", text);
        return text;
    } catch (error) {
        console.error("Gemini V1 Error:", error.response?.data || error.message);
        return "I'm having a bit of trouble thinking right now. How can I help you today? 😊";
    }
}

module.exports = { generateAIResponse };
