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

        if (!validity_start || !validity_end) {
            return res.status(400).json({ success: false, message: "Validity start and end dates are required" });
        }

        const today = new Date().toISOString().split('T')[0];
        if (validity_start < today) {
            return res.status(400).json({ success: false, message: "Start date cannot be in the past" });
        }
        if (validity_end < validity_start) {
            return res.status(400).json({ success: false, message: "End date must be after start date" });
        }

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
        const today = new Date().toISOString().split('T')[0];

        // Auto expire offers before getting stats
        await supabase
            .from('offers')
            .update({ offer_status: 'Expired' })
            .lt('validity_end', today)
            .neq('offer_status', 'Expired')
            .eq('vendor_id', vendor_id);

        const { data: offers } = await supabase
            .from('offers')
            .select('*')
            .eq('vendor_id', vendor_id);

        const { data: claims } = await supabase
            .from('coupon_claims')
            .select('id, redeemed, offers!inner(vendor_id)')
            .eq('offers.vendor_id', vendor_id);

        const totalOffers = offers ? offers.length : 0;
        const activeOffers = offers ? offers.filter(o => o.offer_status === 'Active').length : 0;
        const couponsRedeemed = claims ? claims.filter(c => c.redeemed === true).length : 0;
        const claimsReceived = claims ? claims.length : 0;
        
        // Customer Engagement: Unique customers who claimed
        const uniqueCustomers = claims ? new Set(claims.map(c => c.mobile_number)).size : 0;

        res.json({
            success: true,
            totalOffers,
            activeOffers,
            claimsReceived,
            couponsRedeemed,
            customerEngagement: uniqueCustomers
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
                claim_status: 'redeemed',
                redeemed_at: new Date().toISOString()
            })
            .eq("coupon_code", coupon_code);

        if (updateError) throw updateError;

        return res.json({
            success: true,
            message: `Coupon Redeemed: ${claim.offers?.offer_title} ✅`
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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
        const updateData = { ...req.body };

        // Date validation if dates are being updated
        if (updateData.validity_start || updateData.validity_end) {
            const today = new Date().toISOString().split('T')[0];
            const start = updateData.validity_start;
            const end = updateData.validity_end;

            if (start && start < today) {
                return res.status(400).json({ success: false, message: "Start date cannot be in the past" });
            }
            if (start && end && end < start) {
                return res.status(400).json({ success: false, message: "End date must be after start date" });
            }
        }

        const { error } = await supabase
            .from('offers')
            .update(updateData)
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

        // 4. Mark as Redeemed (Update both redeemed boolean and claim_status)
        const { error: updateError } = await supabase
            .from("coupon_claims")
            .update({
                redeemed: true,
                claim_status: 'redeemed',
                redeemed_at: new Date().toISOString()
            })
            .eq("coupon_code", coupon_code);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: "Coupon Redeemed Successfully ✅",
            offer_title: claim.offers?.offer_title
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get all claimed coupons for a vendor (waiting for redemption)
exports.getVendorClaims = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        const { data, error } = await supabase
            .from('coupon_claims')
            .select(`
                id,
                coupon_code,
                mobile_number,
                redeemed,
                created_at,
                offers!inner (
                    id,
                    offer_title,
                    vendor_id
                )
            `)
            .eq('offers.vendor_id', vendor_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            claims: data.map(item => ({
                id: item.id,
                coupon_code: item.coupon_code,
                customer_mobile: item.mobile_number,
                offer_title: item.offers?.offer_title,
                status: item.redeemed ? 'Redeemed' : 'Claimed',
                claimed_at: item.created_at
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};