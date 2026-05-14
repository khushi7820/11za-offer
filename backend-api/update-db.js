require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function updateDatabase() {
    console.log("Updating database schema...");
    
    // Supabase JS doesn't support ALTER TABLE directly easily via client.
    // However, I'll try to use a direct SQL approach if possible or just inform the user.
    // Actually, I can't run raw SQL via the JS client unless a Postgres function exists.
    
    console.log("Please run this SQL in your Supabase SQL Editor:");
    console.log(`
        ALTER TABLE coupon_claims ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'pending';
        ALTER TABLE coupon_claims ADD COLUMN IF NOT EXISTS redeemed_by_vendor UUID REFERENCES vendors(id);
        UPDATE coupon_claims SET claim_status = 'redeemed' WHERE redeemed = true;
        UPDATE coupon_claims SET claim_status = 'pending' WHERE redeemed = false;
    `);
}

updateDatabase();
