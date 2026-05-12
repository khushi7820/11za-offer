require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkSchema() {
    const { data, error } = await supabase.from('whatsapp_users').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log(Object.keys(data[0] || {}));
    }
}

checkSchema();
