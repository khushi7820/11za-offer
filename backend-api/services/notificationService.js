const supabase = require('../config/supabaseClient');

/**
 * Creates a notification in the database
 * @param {string} userId - ID of the user (customer_id, vendor_id, or admin_id)
 * @param {string} userType - 'customer', 'vendor', or 'admin'
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'claim', 'redeem', 'wallet', 'approval', 'rejection', 'system'
 */
exports.createNotification = async (userId, userType, title, message, type) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert([{
                user_id: userId.toString(),
                user_type: userType,
                title,
                message,
                notification_type: type,
                is_read: false
            }]);

        if (error) {
            console.error('Error creating notification:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error('Notification Service Error:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Get notifications for a user
 */
exports.getNotifications = async (userId, userType, limit = 20, page = 1) => {
    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', userId.toString())
            .eq('user_type', userType)
            .eq('is_read', false) // Only fetch unread notifications
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return { success: true, data, count };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (notificationId) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

/**
 * Mark all notifications as read for a user
 */
exports.markAllAsRead = async (userId, userType) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId.toString())
            .eq('user_type', userType)
            .eq('is_read', false);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
};
