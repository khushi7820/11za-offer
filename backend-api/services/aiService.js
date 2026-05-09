const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI Response using Gemini 2.0 Flash
 */
async function generateAIResponse(message, userName = "User") {
    try {
        console.log(`Generating AI response for ${userName} using gemini-2.0-flash...`);
        
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash"
        });

        const prompt = `
You are 11za AI Assistant.
Platform:
- 11za is an offers and coupon platform.
- Help users politely.
- Keep replies short.
- Use emojis.
- Do not generate long paragraphs.

User Name: ${userName}
User Message: ${message}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("AI Reply:", text);
        return text;

    } catch (error) {
        console.error("FULL GEMINI ERROR:", JSON.stringify(error, null, 2));
        return "AI temporarily unavailable. 🛠️";
    }
}

module.exports = { generateAIResponse };