const Groq = require("groq-sdk");
let groq;

/**
 * Generate AI Response using Groq (Llama 3)
 * Much faster and more stable than Gemini
 */
async function generateAIResponse(message, userName = "User", context = {}) {
    try {
        const { city = "India", categories = [] } = context;
        
        if (!process.env.GROQ_API_KEY) {
            console.warn("GROQ_API_KEY is missing. Falling back to default response.");
            return "How can I help you today? 😊";
        }
        
        if (!groq) {
            groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        console.log(`Generating Groq AI response for ${userName} in ${city}...`);
        
        const catList = categories.length > 0 ? categories.join(", ") : "No offers currently available";

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are the AI assistant for 11za — a WhatsApp offers platform.
                    
                    USER CONTEXT:
                    * User Name: ${userName}
                    * User City: ${city}
                    * Real Available Categories in this city: [${catList}]
                    
                    RULES:
                    1. NEVER list categories or offers that are NOT in the "Real Available Categories" list above.
                    2. If the user asks for offers/categories not in the list, say: "Currently we don't have offers for that in ${city} 😊. Check back soon!"
                    3. If the user's message is unclear, ask them to type "MENU" to see valid options.
                    4. Keep replies under 30 words. No long explanations.
                    5. Never mention "Groq", "Llama", or being an AI model. You are 11za Assistant.`
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