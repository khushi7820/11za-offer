const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// All wallet routes
router.get('/balance/:customer_id', walletController.getWalletBalance);
router.get('/history/:customer_id', walletController.getWalletHistory);
router.post('/recharge', walletController.rechargeWallet);

module.exports = router;
