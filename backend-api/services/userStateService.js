const supabase = require('../config/supabaseClient');

/**
 * Get or Create WhatsApp User
 */
const getOrCreateUser = async (phone_number) => {
    try {
        // Check if user exists
        const { data, error } = await supabase
            .from('whatsapp_users')
            .select('*')
            .eq('phone_number', phone_number)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
            throw error;
        }

        if (data) return data;

        // Create new user if not exists
        const { data: newUser, error: createError } = await supabase
            .from('whatsapp_users')
            .insert([{ 
                phone_number, 
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

/**
 * Update User Data
 */
const updateUser = async (phone_number, updates) => {
    try {
        const { error } = await supabase
            .from('whatsapp_users')
            .update(updates)
            .eq('phone_number', phone_number);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Update User Error:", error.message);
        return false;
    }
};

module.exports = { getOrCreateUser, updateUser };
