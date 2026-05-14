require('dotenv').config();
const analyticsService = require('./services/analyticsService');

async function testStats() {
    try {
        console.log("Testing Global Stats...");
        const stats = await analyticsService.getGlobalStats();
        console.log("Result:", JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit();
}

testStats();
