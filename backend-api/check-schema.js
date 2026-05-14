require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkSchema() {
    const tables = ['wallets', 'wallet_transactions', 'coupon_claims', 'vendor_notifications'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else {
            console.log(`Columns in ${table}:`, Object.keys(data[0] || {}));
        }
    }
}

checkSchema();
