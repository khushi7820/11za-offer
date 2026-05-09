const express = require('express');
const cors = require('cors');
require('dotenv').config();
const vendorRoutes = require('./routes/vendorRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

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
        endpoints: ["/api/vendor", "/api/customer", "/api/admin", "/webhook"]
    });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;