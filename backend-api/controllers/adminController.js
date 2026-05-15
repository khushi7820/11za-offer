const supabase = require('../config/supabaseClient');
const generateToken = require('../utils/generateToken');
const analyticsService = require('../services/analyticsService');

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !data) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Admin Credentials'
            });
        }

        const token = generateToken(data, 'admin');

        res.json({
            success: true,
            message: 'Admin Login Successful',
            token,
            admin: {
                id: data.id,
                name: data.admin_name,
                email: data.email
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('*');

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            vendors: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.approveVendor = async (req, res) => {
    try {
        const { vendor_id } = req.body;

        const { data, error } = await supabase
            .from('vendors')
            .update({ approval_status: 'Approved' })
            .eq('id', vendor_id)
            .select();

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Notification (Non-blocking)
        const notificationService = require('../services/notificationService');
        notificationService.createNotification(
            vendor_id,
            'vendor',
            'Application Approved',
            'Congratulations! Your vendor application has been approved. You can now create offers.',
            'approval'
        );

        res.json({
            success: true,
            message: 'Vendor Approved Successfully',
            vendor: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.rejectVendor = async (req, res) => {

    try {

        const { vendor_id } = req.body;

        const { error } = await supabase
            .from('vendors')
            .update({
                approval_status: 'Rejected'
            })
            .eq('id', vendor_id);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Notification (Non-blocking)
        const notificationService = require('../services/notificationService');
        notificationService.createNotification(
            vendor_id,
            'vendor',
            'Application Rejected',
            'We regret to inform you that your vendor application has been rejected. Please contact support for details.',
            'rejection'
        );

        res.json({
            success: true,
            message: 'Vendor Rejected Successfully'
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

// Analytics Endpoints
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await analyticsService.getGlobalStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllCustomers = async (req, res) => {
    try {
        const { data: customers, error: cError } = await supabase
            .from('customers')
            .select('*')
            .order('joined_at', { ascending: false });

        if (cError) throw cError;

        // Fetch all wallets to merge balances
        const { data: wallets } = await supabase.from('wallets').select('customer_id, balance');

        const walletMap = wallets?.reduce((acc, w) => ({ ...acc, [w.customer_id]: w.balance }), {}) || {};

        const formattedData = customers.map(c => ({
            ...c,
            wallet_balance: walletMap[c.id] || 0
        }));

        res.json({ success: true, customers: formattedData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllClaims = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('coupon_claims')
            .select(`
                *,
                vendors (business_name),
                offers (
                    offer_title,
                    vendors (business_name)
                )
            `)
            .order('claimed_at', { ascending: false });

        if (error) throw error;

        // Ensure vendor name is picked from either source
        const formattedClaims = data.map(c => ({
            ...c,
            vendor_name: c.vendors?.business_name || c.offers?.vendors?.business_name || 'N/A'
        }));

        res.json({ success: true, claims: formattedClaims });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Admin Controls
exports.toggleVendorStatus = async (req, res) => {
    try {
        const { vendor_id, status } = req.body; // status: 'Approved', 'Blocked'
        const { data, error } = await supabase
            .from('vendors')
            .update({ approval_status: status })
            .eq('id', vendor_id)
            .select();

        if (error) throw error;
        res.json({ success: true, message: `Vendor status updated to ${status}`, vendor: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.disableOffer = async (req, res) => {
    try {
        const { offer_id } = req.body;
        const { error } = await supabase
            .from('offers')
            .update({ offer_status: 'Disabled' })
            .eq('id', offer_id);

        if (error) throw error;
        res.json({ success: true, message: 'Offer disabled by Admin' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSystemActivity = async (req, res) => {
    try {
        const { data: claims } = await supabase
            .from('coupon_claims')
            .select('*, offers(offer_title, vendors(business_name))')
            .order('claimed_at', { ascending: false })
            .limit(50);

        const { data: transactions } = await supabase
            .from('wallet_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        res.json({ success: true, recent_claims: claims, recent_transactions: transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};