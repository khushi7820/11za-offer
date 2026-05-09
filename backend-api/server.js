const express = require('express');
const cors = require('cors');

// Test if bcryptjs is the one crashing
try {
    console.log("Attempting to load bcryptjs...");
    const bcrypt = require('bcryptjs');
    console.log("bcryptjs loaded successfully ✅");
} catch (err) {
    console.error("CRITICAL: bcryptjs failed to load!", err.message);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: 'bcryptjs Import Test Running'
    });
});

module.exports = app;