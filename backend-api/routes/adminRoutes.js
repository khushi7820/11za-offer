const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Public route
router.post('/login', adminController.adminLogin);

// Protected Admin Routes
router.use(verifyToken);
router.use(authorizeRoles('admin'));

// Vendor Management
router.get('/all-vendors', adminController.getAllVendors);
router.get('/all-customers', adminController.getAllCustomers);
router.get('/all-claims', adminController.getAllClaims);
router.post('/approve-vendor', adminController.approveVendor);
router.post('/reject-vendor', adminController.rejectVendor);
router.post('/toggle-vendor-status', adminController.toggleVendorStatus);

// Analytics & Monitoring
router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/system-activity', adminController.getSystemActivity);
router.post('/disable-offer', adminController.disableOffer);

module.exports = router;
