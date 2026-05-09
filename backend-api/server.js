const express = require('express');
const cors = require('cors');

// Add vendor routes only to test
const vendorRoutes = require('./routes/vendorRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/vendor', vendorRoutes);

app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: 'Vendor Routes Test Running',
        endpoints: ["/api/vendor"]
    });
});

module.exports = app;