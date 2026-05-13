const supabase = require('../config/supabaseClient');
const walletController = require('../controllers/walletController');

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
            throw new Error("Offer not found");
        }

        // 2. Check for duplicate claim
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
            
            const deduction = await walletController.deductWallet(
                customer_id,
                deductionAmount,
                `Claimed: ${offer.offer_title}`,
                offer_id
            );

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
