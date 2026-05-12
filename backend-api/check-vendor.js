require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkVendor() {
    const { data: vendor, error } = await supabase
        .from('vendors')
        .select('id, email, password, approval_status')
        .eq('email', 'rb@gmail.com')
        .maybeSingle();

    if (error) {
        console.error("Error:", error);
    } else if (!vendor) {
        console.log("Vendor not found!");
    } else {
        console.log("Vendor Found:");
        console.log("Email:", vendor.email);
        console.log("Status:", vendor.approval_status);
        console.log("Password (First 10 chars):", vendor.password.substring(0, 10));
        
        // Check if it's a bcrypt hash (starts with $2a$ or $2b$)
        if (vendor.password.startsWith('$2a$') || vendor.password.startsWith('$2b$')) {
            console.log("Password appears to be properly HASHED.");
        } else {
            console.log("CRITICAL: Password is NOT HASHED. It's likely plain text.");
        }
    }
}

checkVendor();
