const express = require('express');
const cors = require('cors');

// Test if jsonwebtoken (authMiddleware) is the one crashing
try {
    console.log("Attempting to load jsonwebtoken...");
    const jwt = require("jsonwebtoken");
    console.log("jsonwebtoken loaded successfully ✅");
    
    console.log("Attempting to load authMiddleware...");
    const authMiddleware = require('./middleware/authMiddleware');
    console.log("authMiddleware loaded successfully ✅");
} catch (err) {
    console.error("CRITICAL: Auth dependencies failed!", err.message);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: 'Auth Middleware Import Test Running'
    });
});

module.exports = app;