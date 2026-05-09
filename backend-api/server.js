const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    try {
        console.log("Attempting to load vendorController...");
        const vendorController = require('./controllers/vendorController');
        res.json({
            status: "success",
            message: "vendorController loaded successfully! ✅",
            exported_methods: Object.keys(vendorController)
        });
    } catch (err) {
        console.error("LOAD ERROR:", err);
        res.status(500).json({
            status: "error",
            message: "Failed to load vendorController",
            error: err.message,
            stack: err.stack
        });
    }
});

module.exports = app;