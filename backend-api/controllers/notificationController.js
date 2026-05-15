const notificationService = require('../services/notificationService');

exports.getNotifications = async (req, res) => {
    try {
        const { id: userId, role: userType } = req.user; // From JWT payload
        const { page = 1, limit = 20 } = req.query;

        const result = await notificationService.getNotifications(userId, userType, parseInt(limit), parseInt(page));
        
        if (!result.success) throw new Error(result.error);

        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await notificationService.markAsRead(id);
        
        if (!result.success) throw new Error(result.error);

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        const { id: userId, role: userType } = req.user;
        const result = await notificationService.markAllAsRead(userId, userType);
        
        if (!result.success) throw new Error(result.error);

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
