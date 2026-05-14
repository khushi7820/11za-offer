const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const walletController = require('./walletController');
const claimService = require('../services/claimService');

// 1. Secure Customer Registration
exports.customerRegister = async (req, res) => {
    try {
        console.log("Registration Request Body:", req.body);
        const { customer_name, mobile_number, city, email, password } = req.body;

        if (!customer_name || !mobile_number || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if email already exists
        const { data: existing, error: checkError } = await supabase
            .from('customers')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('customers')
            .insert([
                {
                    customer_name,
                    mobile_number,
                    city,
                    email,
                    password: hashedPassword,
                    wallet_balance: 100
                }
            ])
            .select();

        if (error) throw error;

        // Auto-create Wallet
        const customer_id = data[0].id;
        await supabase.from('wallets').insert([{ customer_id, balance: 100 }]);

        res.json({
            success: true,
            message: 'Customer Registered Successfully!',
            customer: data[0]
        });
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Customer Login with JWT
exports.customerLogin = async (req, res) => {
    try {
        console.log("Login Request Body:", req.body);
        const { email, password } = req.body;

        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) throw error;
        
        if (!customer) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid Password' });
        }

        const token = jwt.sign(
            { id: customer.id, role: 'customer' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            customer: { id: customer.id, name: customer.customer_name }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.browseOffers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('offer_status', 'Active');

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            offers: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.claimCoupon = async (req, res) => {
    try {
        const { customer_id, offer_id, mobile_number } = req.body;

        if (!customer_id || !offer_id) {
            return res.status(400).json({ success: false, message: 'customer_id and offer_id are required' });
        }

        const claimResult = await claimService.processClaim({
            customer_id,
            offer_id,
            mobile_number: mobile_number || null // Dashboard might provide mobile_number
        });

        if (!claimResult.success) {
            return res.status(400).json({
                success: claimResult.success,
                message: claimResult.message
            });
        }

        res.json({
            success: true,
            message: claimResult.message,
            coupon: {
                coupon_code: claimResult.couponCode,
                offer_title: claimResult.offerTitle
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getMyCoupons = async (req, res) => {
    try {
        const { customer_id } = req.params;

        const { data: claims, error } = await supabase
            .from('coupon_claims')
            .select('*')
            .eq('customer_id', customer_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }

        const offerIds = [...new Set(claims.map(c => c.offer_id))];
        const vendorIds = [...new Set(claims.map(c => c.vendor_id))];
        
        let offersMap = {};
        let vendorsMap = {};

        if (offerIds.length > 0) {
            const { data: offersData } = await supabase.from('offers').select('id, offer_title').in('id', offerIds);
            offersData?.forEach(o => offersMap[o.id] = o.offer_title);
        }

        if (vendorIds.length > 0) {
            const { data: vendorsData } = await supabase.from('vendors').select('id, business_name').in('id', vendorIds);
            vendorsData?.forEach(v => vendorsMap[v.id] = v.business_name);
        }

        const formatted = claims.map(c => ({
            id: c.id,
            coupon_code: c.coupon_code,
            offer_title: offersMap[c.offer_id] || 'Unknown Offer',
            vendor_name: vendorsMap[c.vendor_id] || 'Unknown Vendor',
            claim_status: c.claim_status || (c.redeemed ? 'redeemed' : 'pending'),
            claimed_at: c.created_at,
            redeemed_at: c.redeemed_at,
            expiry_status: c.claim_status === 'expired' ? 'Expired' : 'Active'
        }));

        res.json({ success: true, coupons: formatted });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const analyticsService = require('../services/analyticsService');

exports.getCustomerStats = async (req, res) => {
    try {
        const { customer_id } = req.params;
        
        // Need mobile number for accurate claim tracking
        const { data: customer } = await supabase.from('customers').select('mobile_number').eq('id', customer_id).single();
        
        const stats = await analyticsService.getCustomerStats(customer_id, customer?.mobile_number);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};