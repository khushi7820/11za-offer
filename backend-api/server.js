const express = require('express');
const cors = require('cors');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const vendorRoutes = require('./routes/vendorRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

console.log("Starting 11za Backend in", process.env.NODE_ENV, "mode");

app.use(cors());
app.use(express.json());

app.use('/api/vendor', vendorRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use("/webhook", webhookRoutes);

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: '11za Backend API is live 🚀',
        env: process.env.NODE_ENV,
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

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;