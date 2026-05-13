const supabase = require('../config/supabaseClient');

/**
 * Global Admin Analytics Service
 */
exports.getGlobalStats = async () => {
    try {
        // 1. Customer Stats
        const { count: totalCustomers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        const { data: cityData } = await supabase.from('customers').select('city');
        const cities = cityData.map(c => c.city).filter(Boolean);
        const cityCounts = cities.reduce((acc, city) => { acc[city] = (acc[city] || 0) + 1; return acc; }, {});
        const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // 2. Offer Stats
        const { count: activeOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true }).eq('offer_status', 'Active');
        const { count: expiredOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true }).eq('offer_status', 'Expired');

        // 3. Vendor Stats
        const { count: totalVendors } = await supabase.from('vendors').select('*', { count: 'exact', head: true });
        const { data: vendorPerformers } = await supabase.from('coupon_claims').select('offers(vendors(business_name))');
        
        // 4. Coupon Stats
        const { count: totalClaims } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true });
        const { count: redeemedCoupons } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('claim_status', 'redeemed');
        const { count: pendingCoupons } = await supabase.from('coupon_claims').select('*', { count: 'exact', head: true }).eq('claim_status', 'pending');

        // 5. Wallet Stats
        const { data: walletTransactions } = await supabase.from('wallet_transactions').select('amount, type');
        const totalDeductions = walletTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalCashback = walletTransactions.filter(t => t.type === 'cashback').reduce((sum, t) => sum + t.amount, 0);

        return {
            success: true,
            summary: {
                totalCustomers,
                activeOffers,
                totalVendors,
                totalClaims,
                redemptionRate: totalClaims > 0 ? ((redeemedCoupons / totalClaims) * 100).toFixed(1) + '%' : '0%'
            },
            customers: {
                total: totalCustomers,
                topCities: topCities.map(([name, count]) => ({ name, count }))
            },
            offers: {
                active: activeOffers,
                expired: expiredOffers
            },
            coupons: {
                total: totalClaims,
                redeemed: redeemedCoupons,
                pending: pendingCoupons
            },
            wallet: {
                totalDeductions,
                totalCashback,
                transactionCount: walletTransactions.length
            }
        };
    } catch (error) {
        console.error("Analytics Service Error:", error);
        throw error;
    }
};
