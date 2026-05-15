const express = require('express');
const cors = require('cors');

// Environment check for local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

console.log("Starting 11za Backend in", process.env.NODE_ENV || 'development', "mode");
console.log("JWT_SECRET set:", !!process.env.JWT_SECRET);
console.log("SUPABASE_URL set:", !!process.env.SUPABASE_URL);

const vendorRoutes = require('./routes/vendorRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const webhookRoutes = require("./routes/webhookRoutes");
const claimRoutes = require("./routes/claimRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/vendor', vendorRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api', claimRoutes); // Mounts /api/claim-offer
app.use("/webhook", webhookRoutes);
app.use("/api/notifications", notificationRoutes);

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: '11za Backend API is live 🚀',
        env: process.env.NODE_ENV || 'development',
        endpoints: ["/api/vendor", "/api/customer", "/api/admin", "/webhook"]
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.stack);
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Port handling for local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;