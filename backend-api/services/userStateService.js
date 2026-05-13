const supabase = require('../config/supabaseClient');

/**
 * Get or Create WhatsApp User
 */
const getOrCreateUser = async (phone_number) => {
    const phoneNumberStr = String(phone_number);
    try {
        const { data, error } = await supabase
            .from('whatsapp_users')
            .select('*')
            .eq('phone_number', phoneNumberStr)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (data) return data;

        const { data: newUser, error: createError } = await supabase
            .from('whatsapp_users')
            .insert([{ 
                phone_number: phoneNumberStr, 
                current_step: 'awaiting_name' 
            }])
            .select()
            .single();

        if (createError) throw createError;
        return newUser;
    } catch (error) {
        console.error("User State Error:", error.message);
        return null;
    }
};

const updateUser = async (phone_number, updates) => {
    const phoneNumberStr = String(phone_number);
    try {
        const { error } = await supabase
            .from('whatsapp_users')
            .update(updates)
            .eq('phone_number', phoneNumberStr);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Update User Error:", error.message);
        return false;
    }
};

module.exports = { getOrCreateUser, updateUser };
