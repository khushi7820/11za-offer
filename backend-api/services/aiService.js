const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Generate AI Response using Groq (Llama 3)
 */
const generateAIResponse = async (userMessage, userName = "User") => {
    try {
        console.log(`Generating Groq AI response for ${userName}...`);
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant for 11za, a platform for exclusive offers.
                    The user's name is: ${userName}.
                    Keep your response friendly, professional, and very short (max 2 sentences).
                    Use emojis.`
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            model: "llama3-8b-8192",
            max_tokens: 100
        });

        const text = chatCompletion.choices[0]?.message?.content || "";
        console.log("Groq AI Reply:", text);
        return text;
    } catch (error) {
        console.error("Groq AI Error:", error.message);
        return `Groq Error: ${error.message} 🛠️`;
    }
};

module.exports = { generateAIResponse };
