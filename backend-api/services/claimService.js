const supabase = require('../config/supabaseClient');
const walletService = require('../services/walletService');

/**
 * Shared Claim Logic for WhatsApp and Dashboard
 */
exports.processClaim = async ({ customer_id, offer_id, mobile_number }) => {
    try {
        console.log(`Processing claim for Customer: ${customer_id}, Offer: ${offer_id}`);

        // 1. Fetch Offer details
        const { data: offer, error: offerError } = await supabase
            .from("offers")
            .select("*, vendors(id, business_name)")
            .eq("id", offer_id)
            .single();

        if (offerError || !offer) {
            return { success: false, message: "Offer not found 🔍" };
        }

        // 2. Status & Expiry Check
        if (offer.offer_status !== 'Active') {
            return { success: false, message: "This offer is no longer active 🛑" };
        }

        const today = new Date().toISOString().split('T')[0];
        if (offer.validity_end && offer.validity_end < today) {
            return { success: false, message: "This offer has expired ⏰" };
        }

        // 3. Check for duplicate claim
        // We check by customer_id if available, otherwise by mobile_number
        let query = supabase.from("coupon_claims").select("*").eq("offer_id", offer_id);
        if (customer_id) {
            query = query.eq("customer_id", customer_id);
        } else {
            query = query.eq("mobile_number", mobile_number);
        }

        const { data: existingClaim } = await query.maybeSingle();
        if (existingClaim) {
            return { success: false, message: "You have already claimed this offer 😊", alreadyClaimed: true };
        }

        // 3. Verify Wallet and Deduct
        const deductionAmount = offer.wallet_deduction_amount || 0;
        
        if (deductionAmount > 0) {
            if (!customer_id) throw new Error("Customer record missing for wallet deduction");
            
            const deduction = await walletService.addTransaction({
                customer_id,
                amount: -deductionAmount,
                type: 'claim_deduction',
                description: `Claimed: ${offer.offer_title}`,
                reference_id: offer_id
            });

            if (!deduction.success) {
                return { success: false, message: deduction.message || "Insufficient wallet balance" };
            }
        }

        // 4. Generate Coupon Code
        const couponCode = "11ZA" + Math.floor(100000 + Math.random() * 900000);

        // 5. Save Coupon Claim
        const { data: claim, error: claimError } = await supabase
            .from("coupon_claims")
            .insert([{
                customer_id: customer_id,
                mobile_number: mobile_number,
                offer_id: offer.id,
                vendor_id: offer.vendor_id || offer.vendors?.id,
                coupon_code: couponCode,
                redeemed: false,
                claim_status: 'pending'
            }])
            .select()
            .single();

        if (claimError) {
            console.error("Claim insertion error:", claimError);
            throw new Error("Failed to save coupon claim");
        }

        // 6. Notifications (Non-blocking)
        const notificationService = require('./notificationService');
        const vendorId = offer.vendor_id || offer.vendors?.id;

        // Customer Notification
        if (customer_id) {
            notificationService.createNotification(
                customer_id,
                'customer',
                'Offer Claimed Successfully',
                `You have claimed "${offer.offer_title}". Your coupon code is ${couponCode}.`,
                'claim'
            );
        }

        // Vendor Notification
        notificationService.createNotification(
            vendorId,
            'vendor',
            'New Coupon Claim',
            `A customer (${mobile_number}) has claimed your offer: ${offer.offer_title}.`,
            'claim'
        );

        console.log(`
NEW CLAIM ALERT
Customer: ${mobile_number}
Offer: ${offer.offer_title}
Coupon: ${couponCode}
Vendor: ${offer.vendors?.business_name}
`);

        return {
            success: true,
            message: "Offer claimed successfully!",
            couponCode,
            offerTitle: offer.offer_title,
            vendorName: offer.vendors?.business_name,
            deductionAmount
        };

    } catch (error) {
        console.error("Claim Service Error:", error);
        return { success: false, message: error.message };
    }
};
