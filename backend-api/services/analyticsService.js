const supabase = require('../config/supabaseClient');

/**
 * Global Admin Analytics Service
 */
exports.getGlobalStats = async () => {
    try {
        // 1. Customer Stats
        const { count: totalCustomers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        const { data: cityData } = await supabase.from('customers').select('city');
        const cities = cityData?.map(c => c.city?.trim()?.toUpperCase()).filter(Boolean) || [];
        const cityCounts = cities.reduce((acc, city) => { acc[city] = (acc[city] || 0) + 1; return acc; }, {});
        const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // 2. Offer Stats
        const { count: totalOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true });
        const { count: activeOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true }).eq('offer_status', 'Active');

        // 3. Vendor Stats
        const { count: totalVendors } = await supabase.from('vendors').select('*', { count: 'exact', head: true });
        const { data: vendorCats } = await supabase.from('vendors').select('business_category');
        const categories = vendorCats?.map(v => v.business_category?.trim()?.toUpperCase()).filter(Boolean) || [];
        const catCounts = categories.reduce((acc, cat) => { acc[cat] = (acc[cat] || 0) + 1; return acc; }, {});
        const topCategories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        // 4. Coupon Stats
        const { count: totalClaims } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true });
        const { count: redeemedCoupons } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('redeemed', true);

        // 5. Wallet Stats
        const { data: walletTransactions } = await supabase.from('wallet_transactions').select('amount, type');
        const totalWalletUsage = walletTransactions?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

        const { count: approvedVendors } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('approval_status', 'Approved');
        const { count: pendingVendors } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('approval_status', 'Pending');
        const { count: rejectedVendors } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('approval_status', 'Rejected');

        return {
            success: true,
            adminStats: {
                totalCustomers: totalCustomers || 0,
                totalVendors: totalVendors || 0,
                totalOffers: totalOffers || 0,
                totalClaims: totalClaims || 0,
                totalRedeemed: redeemedCoupons || 0,
                walletUsage: totalWalletUsage,
                approvedVendors: approvedVendors || 0,
                pendingVendors: pendingVendors || 0,
                rejectedVendors: rejectedVendors || 0,
                topCities: topCities.map(([name, count]) => ({ name, count })),
                topCategories: topCategories.map(([name, count]) => ({ name, count }))
            }
        };
    } catch (error) {
        console.error("Global Analytics Error:", error);
        throw error;
    }
};

/**
 * Vendor Specific Analytics Service
 */
exports.getVendorStats = async (vendorId) => {
    try {
        // 1. Get all offers for this vendor
        const { data: vendorOffers } = await supabase.from('offers').select('id, offer_title').eq('vendor_id', vendorId);
        const offerIds = vendorOffers?.map(o => o.id) || [];

        // 2. Claims & Redemptions (Using vendor_id for accuracy)
        const { count: claimsReceived } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('vendor_id', vendorId);
        const { count: redeemedCoupons } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('redeemed', true);
        const { count: activeOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('offer_status', 'Active');

        return {
            success: true,
            vendorStats: {
                claimsReceived: claimsReceived || 0,
                redeemedCoupons: redeemedCoupons || 0,
                activeOffers: activeOffers || 0,
                pendingRedeems: (claimsReceived || 0) - (redeemedCoupons || 0)
            }
        };
    } catch (error) {
        console.error("Vendor Analytics Error:", error);
        throw error;
    }
};

/**
 * Customer Specific Analytics Service
 */
exports.getCustomerStats = async (customerId, mobileNumber) => {
    try {
        // 1. Wallet Balance
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('customer_id', customerId).maybeSingle();
        
        // 2. Claims
        const { count: totalClaimed } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('mobile_number', mobileNumber);
        const { count: totalRedeemed } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('mobile_number', mobileNumber).eq('redeemed', true);

        return {
            success: true,
            customerStats: {
                walletBalance: wallet?.balance || 0,
                totalClaimed: totalClaimed || 0,
                totalRedeemed: totalRedeemed || 0
            }
        };
    } catch (error) {
        console.error("Customer Analytics Error:", error);
        throw error;
    }
};
