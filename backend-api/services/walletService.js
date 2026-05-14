const supabase = require('../config/supabaseClient');

/**
 * Unified Wallet Service
 * Handles balance updates and transaction ledger recording
 */
exports.addTransaction = async ({ customer_id, amount, type, description, reference_id }) => {
    try {
        console.log(`Processing wallet transaction: ${type} for Customer: ${customer_id}, Amount: ${amount}`);

        // 1. Get current balance
        const { data: wallet, error: fetchError } = await supabase
            .from('wallets')
            .select('balance')
            .eq('customer_id', customer_id)
            .maybeSingle();

        let balance_before = 0;
        if (wallet) {
            balance_before = parseFloat(wallet.balance);
        }

        const balance_after = balance_before + parseFloat(amount);

        // 2. Check for insufficient balance if deducting
        if (amount < 0 && balance_after < 0) {
            return { success: false, message: "Insufficient wallet balance 💰" };
        }

        // 3. Update or Create Wallet
        const { error: walletError } = await supabase
            .from('wallets')
            .upsert({ 
                customer_id, 
                balance: balance_after,
                last_updated: new Date()
            }, { onConflict: 'customer_id' });

        if (walletError) throw walletError;

        // 3. Create Ledger Entry
        const { error: ledgerError } = await supabase
            .from('wallet_transactions')
            .insert([{
                customer_id,
                type, // Using existing 'type' column for transaction_type
                amount: parseFloat(amount),
                balance_before,
                balance_after,
                description,
                reference_id,
                created_at: new Date().toISOString()
            }]);

        if (ledgerError) throw ledgerError;

        return { success: true, balance_after };

    } catch (error) {
        console.error("Wallet Service Error:", error);
        return { success: false, message: error.message };
    }
};
