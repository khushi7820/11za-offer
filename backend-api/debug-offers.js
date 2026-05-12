require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function debugOffers() {
    const city = 'mumbai'; // Change this to user's actual city if different
    const category = 'food';

    const { data: offers, error } = await supabase
        .from("offers")
        .select(`
            id,
            offer_title,
            wallet_deduction_amount,
            city,
            vendors!inner (
                business_category
            )
        `)
        .eq("offer_status", "Active")
        .ilike("city", `%${city}%`)
        .ilike("vendors.business_category", `%${category}%`);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Offers found:", offers.length);
        offers.forEach(o => {
            console.log(`- ${o.offer_title} (ID: ${o.id}) [Cat: ${o.vendors.business_category}] [City: ${o.city}]`);
        });
    }
}

debugOffers();
