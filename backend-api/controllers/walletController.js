const supabase = require('../config/supabaseClient');

// Get Wallet Balance
exports.getWalletBalance = async (req, res) => {
    try {
        const { customer_id } = req.params;

        const { data, error } = await supabase
            .from('wallets')
            .select('balance')
            .eq('customer_id', customer_id)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            balance: data ? data.balance : 0
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get Transaction History (Ledger)
exports.getWalletHistory = async (req, res) => {
    try {
        const { customer_id } = req.params;

        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('customer_id', customer_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            transactions: data
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Wallet Deduction Engine (Used during Coupon Claim)
// This is an internal helper, but can be an API
exports.deductWallet = async (customer_id, amount, description, reference_id) => {
    try {
        // 1. Get current balance
        const { data: wallet, error: fetchError } = await supabase
            .from('wallets')
            .select('balance')
            .eq('customer_id', customer_id)
            .single();

        if (fetchError || !wallet) throw new Error('Wallet not found');

        const balance_before = parseFloat(wallet.balance);
        const deduct_amount = parseFloat(amount);

        // 2. Check sufficiency
        if (balance_before < deduct_amount) {
            throw new Error('Insufficient wallet balance');
        }

        const balance_after = balance_before - deduct_amount;

        // 3. Update Wallet Balance
        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: balance_after })
            .eq('customer_id', customer_id);

        if (updateError) throw updateError;

        // 4. Create Ledger Entry
        const { error: ledgerError } = await supabase
            .from('wallet_transactions')
            .insert([{
                customer_id,
                type: 'coupon_claim',
                amount: -deduct_amount,
                balance_before,
                balance_after,
                description,
                reference_id
            }]);

        if (ledgerError) throw ledgerError;

        return { success: true, balance_after };

    } catch (err) {
        return { success: false, message: err.message };
    }
};

// Recharge Wallet
exports.rechargeWallet = async (req, res) => {
    try {
        const { customer_id, amount, payment_id } = req.body;
        
        // 1. Get current balance
        const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('customer_id', customer_id)
            .single();

        const balance_before = wallet ? parseFloat(wallet.balance) : 0;
        const recharge_amount = parseFloat(amount);
        const balance_after = balance_before + recharge_amount;

        // 2. Update/Create Wallet
        const { error: walletError } = await supabase
            .from('wallets')
            .upsert({ 
                customer_id, 
                balance: balance_after,
                last_recharge_amount: recharge_amount,
                last_recharge_date: new Date()
            }, { onConflict: 'customer_id' });

        if (walletError) throw walletError;

        // 3. Create Transaction Entry
        const { error: ledgerError } = await supabase
            .from('wallet_transactions')
            .insert([{
                customer_id,
                type: 'recharge',
                amount: recharge_amount,
                balance_before,
                balance_after,
                description: 'Wallet Recharge',
                reference_id: payment_id
            }]);

        if (ledgerError) throw ledgerError;

        res.json({
            success: true,
            message: 'Recharge Successful',
            new_balance: balance_after
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
