require('dotenv').config();
const supabase = require('../config/supabaseClient');
const notificationService = require('../services/notificationService');

async function simulateVendorNotif() {
    console.log("Simulating Admin Notification...");
    const { data: admins } = await supabase.from('admins').select('id').limit(1);
    
    if (admins && admins.length > 0) {
        const adminId = admins[0].id;
        const result = await notificationService.createNotification(
            adminId,
            'admin',
            'Test Notification',
            'This is a test notification for the admin.',
            'system'
        );
        console.log("Result:", result);
    } else {
        console.log("No admins found.");
    }
}

simulateVendorNotif();
