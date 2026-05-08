const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/login', adminController.adminLogin);
router.get('/all-vendors', adminController.getAllVendors);
router.post('/approve-vendor', adminController.approveVendor);
router.post('/reject-vendor', adminController.rejectVendor);

module.exports = router;
