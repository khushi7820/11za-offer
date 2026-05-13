const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');

// Unified Claim Route
router.post('/claim-offer', claimController.claimOffer);

module.exports = router;
