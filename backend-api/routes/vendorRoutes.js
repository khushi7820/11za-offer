const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/signup', vendorController.vendorSignup);
router.post('/login', vendorController.vendorLogin);

// Protected Routes
router.post('/create-offer', authMiddleware, vendorController.createOffer);
router.get('/my-offers/:vendor_id', authMiddleware, vendorController.getVendorOffers);
router.get('/dashboard-stats/:vendor_id', authMiddleware, vendorController.dashboardStats);
router.post('/verify-coupon', authMiddleware, vendorController.verifyCoupon);
router.delete('/delete-offer/:id', authMiddleware, vendorController.deleteOffer);
router.put('/update-offer/:id', authMiddleware, vendorController.updateOffer);
router.get('/activity/:vendor_id', authMiddleware, vendorController.getVendorActivity);

module.exports = router;