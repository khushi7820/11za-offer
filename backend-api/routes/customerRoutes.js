const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const claimController = require('../controllers/claimController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', customerController.customerRegister);
router.post('/login', customerController.customerLogin);

// Protected routes (Customer & Admin)
router.use(verifyToken);
router.use(authorizeRoles('customer', 'admin'));

router.get('/browse-offers', customerController.browseOffers);
router.post('/claim-coupon', claimController.claimOffer);
router.get('/my-coupons/:customer_id', customerController.getMyCoupons);

module.exports = router;