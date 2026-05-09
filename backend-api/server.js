const express = require('express');
const cors = require('cors');

// Test if Supabase is the one crashing
try {
    const supabase = require('./config/supabaseClient');
    console.log("Supabase Client initialized successfully");
} catch (err) {
    console.error("CRITICAL: Supabase initialization failed!", err);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: 'Supabase Import Test Running',
        supabase_url_exists: !!process.env.SUPABASE_URL
    });
});

module.exports = app;