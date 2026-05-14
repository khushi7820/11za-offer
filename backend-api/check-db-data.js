require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkData() {
    console.log("Checking Supabase tables...");
    
    const { count: vendorsCount, error: vError } = await supabase.from('vendors').select('*', { count: 'exact', head: true });
    console.log("Total Vendors:", vendorsCount);
    if (vError) console.error("Vendors Error:", vError);

    const { count: customersCount, error: cError } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    console.log("Total Customers:", customersCount);
    if (cError) console.error("Customers Error:", cError);

    const { count: offersCount, error: oError } = await supabase.from('offers').select('*', { count: 'exact', head: true });
    console.log("Total Offers:", offersCount);
    if (oError) console.error("Offers Error:", oError);

    process.exit();
}

checkData();
