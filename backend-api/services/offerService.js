const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fetch active offers from Supabase
 */
const getActiveOffers = async (category = null) => {
    try {
        let query = supabase
            .from("offers")
            .select("*")
            .eq("offer_status", "Active");

        if (category) {
            query = query.ilike("category", `%${category}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Fetch Offers Error:", error.message);
        return [];
    }
};

module.exports = { getActiveOffers };
