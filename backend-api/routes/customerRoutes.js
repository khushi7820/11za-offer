const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', customerController.customerRegister);
router.post('/login', customerController.customerLogin);

// Protected routes (Require JWT)
router.get('/browse-offers', authMiddleware, customerController.browseOffers);
router.post('/claim-coupon', authMiddleware, customerController.claimCoupon);
router.get('/my-coupons/:customer_id', authMiddleware, customerController.getMyCoupons);

module.exports = router;