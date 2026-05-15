require('dotenv').config();
const supabase = require('../config/supabaseClient');

async function checkNotifications() {
    console.log("Checking notifications table...");
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log(`Found ${data.length} notifications.`);
    console.log(JSON.stringify(data, null, 2));
}

checkNotifications();
