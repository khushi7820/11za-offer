const supabase = require('../config/supabaseClient');

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

        res.json({
            success: true,
            message: 'Admin Login Successful',
            admin: data
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