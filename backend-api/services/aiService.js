const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI Response using Gemini (Model: gemini-1.5-flash-001)
 */
async function generateAIResponse(message, userName = "User") {
    try {
        console.log(`Generating AI response for ${userName} using gemini-1.5-flash-001...`);
        
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        const prompt = `You are a helpful assistant for 11za, a platform for exclusive offers. 
        User name: ${userName}. 
        User message: ${message}. 
        Keep response very short and use emojis.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        console.log("AI Generated Reply:", response);
        return response;
    } catch (error) {
        console.error("Gemini V1 Error:", JSON.stringify(error, null, 2));
        return `Gemini New Key Error: ${error.message || JSON.stringify(error)} 🛠️`;
    }
}

module.exports = { generateAIResponse };
