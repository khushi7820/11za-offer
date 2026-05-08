const supabase = require('../config/supabaseClient');
const vendorController = require('./vendorController');

// WhatsApp Webhook Handler
exports.handleWebhook = async (req, res) => {
    try {
        const body = req.body;

        // Note: Actual WhatsApp API structure depends on provider (Meta, Twilio, etc.)
        // This is a generalized structure for incoming text messages.
        if (body.object === 'whatsapp_business_account') {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from; // Vendor's mobile number
            const text = message.text.body.trim().toLowerCase();

            // Check if Vendor exists with this mobile number
            const { data: vendor } = await supabase
                .from('vendors')
                .select('id, business_name')
                .eq('mobile_number', from)
                .single();

            if (!vendor) {
                // Not a registered vendor
                return res.status(200).send('NOT_REGISTERED');
            }

            // Logic: VERIFY [CODE]
            if (text.startsWith('verify ')) {
                const coupon_code = text.replace('verify ', '').toUpperCase();
                
                // Call existing verification logic (internally)
                // We'll refactor verifyCoupon to be callable internally or replicate logic
                const result = await internalVerify(vendor.id, coupon_code);
                
                // Send response back to WhatsApp (Using Meta API or similar)
                // sendMessage(from, result.message);
            }

            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        console.error("WhatsApp Webhook Error:", err);
        res.sendStatus(200); // Always send 200 to WhatsApp to avoid retries
    }
};

// Internal Helper for Verification via WhatsApp
async function internalVerify(vendor_id, coupon_code) {
    try {
        const { data: coupon, error: fetchError } = await supabase
            .from('coupons')
            .select('*, offers(*)')
            .eq('coupon_code', coupon_code)
            .eq('vendor_id', vendor_id)
            .single();

        if (fetchError || !coupon) return { message: '❌ Invalid Coupon Code.' };
        if (coupon.coupon_status === 'Used') return { message: '⚠️ Coupon already used.' };

        // Mark as used
        await supabase.from('coupons').update({
            coupon_status: 'Used',
            redeem_date: new Date().toISOString()
        }).eq('id', coupon.id);

        // Log transaction
        await supabase.from('transactions').insert([{
            vendor_id,
            customer_id: coupon.customer_id,
            coupon_id: coupon.id,
            amount: coupon.offers?.wallet_deduction_amount || 0,
            transaction_type: 'Redemption',
            description: `Redeemed via WhatsApp: ${coupon_code}`,
            transaction_date: new Date().toISOString()
        }]);

        return { message: `✅ Verified! Offer: ${coupon.offers?.offer_title}` };
    } catch (err) {
        return { message: '❌ System Error.' };
    }
}

// Webhook Verification for Meta (One-time setup)
exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
};
