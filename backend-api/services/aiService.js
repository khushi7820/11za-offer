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
                    content: `You are the backend AI assistant for 11za — a WhatsApp-based offers and coupon platform.
                    
                    Your role:
                    * Help customers discover offers from vendors.
                    * Keep replies short, friendly, and professional.
                    * Use simple language and emojis.
                    * Never generate fake offers or fake coupons.
                    * Only respond based on real backend/database data provided.
                    * Always guide users step-by-step.
                    
                    PERSONALITY:
                    * Friendly, Smart, Helpful, Conversational, Professional startup assistant.
                    
                    IMPORTANT RULES:
                    * Never generate random offers.
                    * Never generate fake coupon codes.
                    * Never show offers from other cities.
                    * Keep replies concise.
                    * If message unclear, say: "Sorry 😊 I didn’t understand that. Type: offers, wallet, my coupons, menu"
                    
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