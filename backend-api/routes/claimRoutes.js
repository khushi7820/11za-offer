const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const { verifyToken } = require('../middleware/authMiddleware');

// Unified Claim Route (Protected)
router.post('/claim-offer', verifyToken, claimController.claimOffer);

module.exports = router;
