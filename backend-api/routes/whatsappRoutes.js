const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// WhatsApp Webhook Endpoints
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

module.exports = router;
