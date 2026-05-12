require('dotenv').config();
const supabase = require('./config/supabaseClient');
const bcrypt = require('bcryptjs');

async function resetVendorPassword() {
    const newPassword = '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const { data, error } = await supabase
        .from('vendors')
        .update({ 
            password: hashedPassword,
            approval_status: 'Approved' // Ensure status is exactly 'Approved'
        })
        .eq('email', 'rb@gmail.com')
        .select();

    if (error) {
        console.error("Error updating vendor:", error);
    } else {
        console.log("Vendor Password Reset Successfully to: 123456");
        console.log("Updated Data:", data);
    }
}

resetVendorPassword();
