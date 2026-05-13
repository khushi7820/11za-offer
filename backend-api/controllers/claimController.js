const claimService = require('../services/claimService');

/**
 * Unified Claim Controller
 * Used by both Dashboard (via HTTP) and WhatsApp (via internal call or HTTP)
 */
exports.claimOffer = async (req, res) => {
    try {
        const { customer_id, offer_id, mobile_number } = req.body;

        if (!offer_id) {
            return res.status(400).json({ success: false, message: "offer_id is required" });
        }

        // Dashboard uses customer_id, WhatsApp uses mobile_number (initially)
        if (!customer_id && !mobile_number) {
            return res.status(400).json({ success: false, message: "customer_id or mobile_number is required" });
        }

        const result = await claimService.processClaim({
            customer_id,
            offer_id,
            mobile_number
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error("Claim Controller Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
