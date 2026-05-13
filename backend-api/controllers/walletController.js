const supabase = require('../config/supabaseClient');
const walletService = require('../services/walletService');

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

// Wallet Deduction Engine
exports.deductWallet = async (customer_id, amount, description, reference_id) => {
    return await walletService.addTransaction({
        customer_id,
        amount: -amount,
        type: 'claim_deduction',
        description,
        reference_id
    });
};

// Recharge Wallet
exports.rechargeWallet = async (req, res) => {
    try {
        const { customer_id, amount, payment_id } = req.body;
        
        const result = await walletService.addTransaction({
            customer_id,
            amount,
            type: 'recharge',
            description: 'Wallet Recharge',
            reference_id: payment_id
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Recharge Successful',
            new_balance: result.balance_after
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
