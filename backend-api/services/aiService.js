const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI Response using Gemini
 */
const generateAIResponse = async (userMessage, userName = "User") => {
    try {
        console.log(`Generating AI response for ${userName}...`);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `You are a helpful assistant for 11za, a platform for exclusive offers.
        The user's name is: ${userName}.
        User says: "${userMessage}"
        
        Keep your response friendly, professional, and very short (max 2 sentences).
        Use emojis.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("AI Generated Reply:", text);
        return text;
    } catch (error) {
        console.error("Gemini AI Error:", error.message);
        return `Gemini New Error: ${error.message} 🛠️`;
    }
};

module.exports = { generateAIResponse };
