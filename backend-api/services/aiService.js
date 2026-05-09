const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI Response using Gemini (Latest SDK implementation)
 */
async function generateAIResponse(message, userName = "User") {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        // Adding a bit of context for 11za
        const prompt = `User name: ${userName}. User says: ${message}. Keep it short and use emojis. Context: You are an assistant for 11za offers platform.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        return response;
    } catch (error) {
        console.log("Gemini New Error:", error);
        return "I'm having a bit of trouble thinking right now. How can I help you today? 😊";
    }
}

module.exports = { generateAIResponse };
