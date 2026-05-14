const supabase = require('../config/supabaseClient');

/**
 * Shared Redemption Logic
 */
exports.redeemCoupon = async ({ coupon_code, vendor_id }) => {
    try {
        console.log(`Processing redemption for Vendor: ${vendor_id}, Coupon: ${coupon_code}`);

        // 1. Fetch Coupon Claim
        const { data: claim, error: claimError } = await supabase
            .from("coupon_claims")
            .select("*")
            .eq("coupon_code", coupon_code)
            .maybeSingle();

        if (claimError || !claim) {
            return { success: false, message: "Invalid Coupon Code ❌" };
        }

        // 1b. Fetch Offer Details separately (to bypass missing FK relationship)
        const { data: offer, error: offerError } = await supabase
            .from("offers")
            .select("id, vendor_id, offer_title, validity_end, offer_status")
            .eq("id", claim.offer_id)
            .maybeSingle();

        if (offerError || !offer) {
            return { success: false, message: "Associated offer not found ❌" };
        }

        // Add offer details to claim object for existing logic
        claim.offers = offer;

        // 2. Security Check: Belongs to this vendor?
        const offerVendorId = claim.offers?.vendor_id;
        if (offerVendorId !== vendor_id) {
            return { success: false, message: "This coupon belongs to another vendor 🚫" };
        }

        // 3. Status Check: Already redeemed?
        if (claim.redeemed || claim.claim_status === 'redeemed') {
            return { success: false, message: "Coupon already redeemed ⚠️" };
        }

        // 4. Validity Check: Expired?
        const today = new Date().toISOString().split('T')[0];
        if (claim.offers?.validity_end && claim.offers.validity_end < today) {
            // Auto-update status to expired if we found it here
            await supabase.from("coupon_claims").update({ claim_status: 'expired' }).eq("id", claim.id);
            return { success: false, message: "This offer has expired ⏰" };
        }

        // 5. Finalize Redemption
        const { error: updateError } = await supabase
            .from("coupon_claims")
            .update({
                redeemed: true,
                redeemed_at: new Date().toISOString(),
                claim_status: 'redeemed'
            })
            .eq("id", claim.id);

        if (updateError) {
            console.error("Redemption update error:", updateError);
            throw new Error("Failed to update coupon status");
        }

        return {
            success: true,
            message: "Coupon Redeemed Successfully ✅",
            offerTitle: claim.offers?.offer_title,
            customerMobile: claim.mobile_number
        };

    } catch (error) {
        console.error("Redemption Service Error:", error);
        return { success: false, message: error.message };
    }
};
