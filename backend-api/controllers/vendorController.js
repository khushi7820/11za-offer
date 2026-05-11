const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');


exports.vendorSignup = async (req, res) => {
    try {
        const {
            business_name,
            owner_name,
            mobile_number,
            email,
            password,
            business_category,
            business_address,
            gst_pan,
            documents
        } = req.body;
        if (
            !business_name ||
            !owner_name ||
            !mobile_number ||
            !email ||
            !password ||
            !business_category
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please fill all required fields'
            });
        }

        const mobileRegex = /^[0-9]{10}$/;

        if (!mobileRegex.test(mobile_number)) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number must be 10 digits'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }
        const { data: existingVendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('email', email)
            .single();

        if (existingVendor) {
            return res.status(400).json({
                success: false,
                message: 'Vendor already registered. Please login.'
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('vendors')
            .insert([
                {
                    business_name,
                    owner_name,
                    mobile_number,
                    email,
                    password: hashedPassword,
                    business_category,
                    business_address,
                    gst_pan,
                    documents,
                    approval_status: 'Pending'
                }
            ])
            .select();

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Vendor Registered Successfully. Waiting For Admin Approval.',
            vendor: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.vendorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !vendor) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Email or Password'
            });
        }

        const isMatch = await bcrypt.compare(password, vendor.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Email or Password'
            });
        }

        if (vendor.approval_status !== 'Approved') {
            return res.status(403).json({
                success: false,
                message: 'Vendor Waiting For Admin Approval'
            });
        }

        const token = generateToken(vendor);

        res.json({
            success: true,
            message: 'Vendor Login Successful',
            token,
            vendor: {
                id: vendor.id,
                business_name: vendor.business_name,
                email: vendor.email
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.createOffer = async (req, res) => {
    try {
        const {
            vendor_id,
            offer_title,
            offer_description,
            discount_type,
            discount_value,
            validity_start,
            validity_end,
            terms_conditions,
            wallet_deduction_amount,
            city
        } = req.body;

        // Duplicate Check (Check if same title created recently)
        const { data: existingOffer } = await supabase
            .from('offers')
            .select('id')
            .eq('vendor_id', vendor_id)
            .eq('offer_title', offer_title)
            .eq('offer_status', 'Active')
            .limit(1)
            .maybeSingle();

        if (existingOffer) {
            return res.status(400).json({ success: false, message: "An active offer with this title already exists!" });
        }

        // Generate unique offer code (e.g. OFFER4821)
        const offerCode = "OFFER" + Math.floor(1000 + Math.random() * 9000);
 
        const { data, error } = await supabase
            .from('offers')
            .insert([
                {
                    vendor_id,
                    offer_title,
                    offer_description,
                    discount_type,
                    discount_value,
                    validity_start,
                    validity_end,
                    terms_conditions,
                    wallet_deduction_amount,
                    city,
                    offer_code: offerCode,
                    offer_status: 'Active'
                }
            ])
            .select();

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Offer Created Successfully',
            offer: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getVendorOffers = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        const today = new Date().toISOString().split('T')[0];

        // Auto expire offers (only if validity_end is strictly in the past)
        await supabase
            .from('offers')
            .update({
                offer_status: 'Expired'
            })
            .lt('validity_end', today)
            .neq('offer_status', 'Expired');

        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('vendor_id', vendor_id);

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

exports.dashboardStats = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        const { data: offers } = await supabase
            .from('offers')
            .select('*')
            .eq('vendor_id', vendor_id);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('vendor_id', vendor_id);

        const totalOffers = offers ? offers.length : 0;
        const activeOffers = offers ? offers.filter(o => o.offer_status === 'Active').length : 0;
        const couponsClaimed = transactions ? transactions.length : 0;
        const walletUsed = transactions
            ? transactions.reduce((sum, item) => sum + Number(item.wallet_used || 0), 0)
            : 0;

        res.json({
            success: true,
            totalOffers,
            activeOffers,
            couponsClaimed,
            walletUsed
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.verifyCoupon = async (req, res) => {
    try {
        const { coupon_code, vendor_id } = req.body;

        if (!coupon_code || !vendor_id) {
            return res.status(400).json({ success: false, message: 'Coupon code and Vendor ID are required' });
        }

        // --- STEP 1: Try finding in traditional 'coupons' table ---
        const { data: traditionalCoupon } = await supabase
            .from('coupons')
            .select('*, offers(*)')
            .eq('coupon_code', coupon_code)
            .eq('vendor_id', vendor_id)
            .maybeSingle();

        if (traditionalCoupon) {
            if (traditionalCoupon.coupon_status === 'Used') {
                return res.status(400).json({ success: false, message: 'Coupon Already Used' });
            }

            const { error: updateError } = await supabase
                .from('coupons')
                .update({
                    coupon_status: 'Used',
                    redeem_date: new Date().toISOString()
                })
                .eq('coupon_code', coupon_code);

            if (updateError) throw updateError;

            return res.json({ success: true, message: 'Traditional Coupon Redeemed Successfully ✅' });
        }

        // --- STEP 2: Fallback to 'coupon_claims' (WhatsApp Flow) ---
        const { data: claim, error: claimError } = await supabase
            .from("coupon_claims")
            .select(`
                *,
                offers (
                    id,
                    vendor_id,
                    offer_title,
                    wallet_deduction_amount
                )
            `)
            .eq("coupon_code", coupon_code)
            .maybeSingle();

        if (claimError || !claim) {
            return res.status(404).json({ success: false, message: 'Invalid Coupon Code ❌' });
        }

        // Check if this coupon belongs to THIS vendor
        if (claim.offers?.vendor_id !== vendor_id) {
            return res.status(403).json({ success: false, message: 'This coupon belongs to another vendor 🚫' });
        }

        if (claim.redeemed) {
            return res.status(400).json({ success: false, message: 'Coupon already redeemed ⚠️' });
        }

        // Get customer_id for transaction
        const { data: user } = await supabase
            .from("whatsapp_users")
            .select("customer_id")
            .eq("phone_number", claim.mobile_number)
            .single();

        // Mark as Redeemed
        const { error: updateError } = await supabase
            .from("coupon_claims")
            .update({
                redeemed: true,
                redeemed_at: new Date().toISOString()
            })
            .eq("coupon_code", coupon_code);

        if (updateError) throw updateError;

        // Record Transaction
        const deduction = claim.offers?.wallet_deduction_amount || 0;
        await supabase
            .from("transactions")
            .insert([{
                vendor_id: vendor_id,
                customer_id: user?.customer_id || null,
                offer_id: claim.offer_id,
                coupon_code: coupon_code,
                amount: deduction,
                wallet_used: deduction,
                transaction_type: 'Redemption',
                transaction_status: 'Completed',
                transaction_date: new Date().toISOString()
            }]);

        return res.json({
            success: true,
            message: `Coupon Redeemed: ${claim.offers?.offer_title} ✅`
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getVendorActivity = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('vendor_id', vendor_id)
            .order('transaction_date', { ascending: false })
            .limit(20);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            activity: data
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Offer Deleted Successfully'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.updateOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('offers')
            .update(req.body)
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Offer Updated Successfully'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// Get Vendor Activity (Refined with Customer Names)
exports.getVendorActivity = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        const { data, error } = await supabase
            .from('transactions')
            .select(`
                id,
                description,
                transaction_date,
                amount,
                transaction_type,
                customers (customer_name)
            `)
            .eq('vendor_id', vendor_id)
            .order('transaction_date', { ascending: false })
            .limit(20);

        if (error) throw error;

        res.json({
            success: true,
            activity: data.map(item => ({
                id: item.id,
                description: item.description,
                customer: item.customers?.customer_name || 'Walk-in Customer',
                time: item.transaction_date,
                amount: item.amount,
                type: item.transaction_type
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Redeem Coupon claimed via WhatsApp
exports.redeemWhatsAppCoupon = async (req, res) => {
    try {
        const { coupon_code, vendor_id } = req.body;

        if (!coupon_code || !vendor_id) {
            return res.status(400).json({ success: false, message: "Coupon code and Vendor ID are required" });
        }

        // 1. Verify Coupon in coupon_claims table
        const { data: claim, error } = await supabase
            .from("coupon_claims")
            .select(`
                *,
                offers (
                    id,
                    offer_title,
                    wallet_deduction_amount
                )
            `)
            .eq("coupon_code", coupon_code)
            .maybeSingle();

        if (error || !claim) {
            return res.status(404).json({ success: false, message: "Invalid Coupon Code ❌" });
        }

        // 2. Check if already redeemed
        if (claim.redeemed) {
            return res.status(400).json({ success: false, message: "Coupon already redeemed ⚠️" });
        }

        // 3. Get Customer details from whatsapp_users
        const { data: user } = await supabase
            .from("whatsapp_users")
            .select("customer_id")
            .eq("phone_number", claim.mobile_number)
            .single();

        // 4. Mark as Redeemed
        const { error: updateError } = await supabase
            .from("coupon_claims")
            .update({
                redeemed: true,
                redeemed_at: new Date().toISOString()
            })
            .eq("coupon_code", coupon_code);

        if (updateError) throw updateError;

        // 5. Record Transaction
        const deduction = claim.offers?.wallet_deduction_amount || 0;
        await supabase
            .from("transactions")
            .insert([{
                vendor_id: vendor_id,
                customer_id: user?.customer_id || null,
                offer_id: claim.offer_id,
                coupon_code: coupon_code,
                amount: deduction,
                wallet_used: deduction,
                transaction_type: 'Redemption',
                transaction_status: 'Completed',
                transaction_date: new Date().toISOString()
            }]);

        res.json({
            success: true,
            message: "Coupon Redeemed Successfully ✅",
            offer_title: claim.offers?.offer_title
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};