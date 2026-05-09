const Groq = require("groq-sdk");

// Use GROQ_API_KEY from environment variables
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Generate AI Response using Groq (Llama 3)
 * Much faster and more stable than Gemini
 */
async function generateAIResponse(message, userName = "User") {
    try {
        console.log(`Generating Groq AI response for ${userName}...`);
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are 11za AI Assistant.
                    Platform: 11za is an offers and coupon platform.
                    Reply short with emojis.
                    User Name: ${userName}`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "llama-3.3-70b-versatile",
            max_tokens: 100
        });

        const text = chatCompletion.choices[0]?.message?.content || "";
        console.log("Groq AI Reply:", text);
        return text;

    } catch (error) {
        console.error("Groq AI Error:", error.message);
        return "I'm having a bit of trouble thinking right now. How can I help you today? 😊";
    }
}

module.exports = { generateAIResponse };