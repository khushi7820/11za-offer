const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Public Routes
router.post('/signup', vendorController.vendorSignup);
router.post('/login', vendorController.vendorLogin);

// Protected Routes (Vendor & Admin)
router.use(verifyToken);
router.use(authorizeRoles('vendor', 'admin'));

router.post('/create-offer', vendorController.createOffer);
router.get('/my-offers/:vendor_id', vendorController.getVendorOffers);
router.get('/dashboard-stats/:vendor_id', vendorController.dashboardStats);
router.post('/verify-coupon', vendorController.verifyCoupon);
router.post('/redeem-coupon', vendorController.redeemWhatsAppCoupon);
router.delete('/delete-offer/:id', vendorController.deleteOffer);
router.put('/update-offer/:id', vendorController.updateOffer);
router.get('/activity/:vendor_id', vendorController.getVendorActivity);
router.get('/claims/:vendor_id', vendorController.getVendorClaims);
router.get('/notifications/:vendor_id', vendorController.getVendorNotifications);

module.exports = router;