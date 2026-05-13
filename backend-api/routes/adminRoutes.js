const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Public route
router.post('/login', adminController.adminLogin);

// Protected Admin Routes
router.use(verifyToken);
router.use(authorizeRoles('admin'));

router.get('/all-vendors', adminController.getAllVendors);
router.post('/approve-vendor', adminController.approveVendor);
router.post('/reject-vendor', adminController.rejectVendor);

module.exports = router;
