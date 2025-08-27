const notificationService = require("../services/notificationService");

const getNotifications = async (req, res, next) => {
	try {
		const notifications = await notificationService.getUserNotifications(
			req.user.id,
			req.query
		);
		res.status(200).json({ success: true, data: notifications });
	} catch (error) {
		next(error);
	}
};

const markAsRead = async (req, res, next) => {
	try {
		const { notificationIds } = req.body; // آرایه‌ای از ID ها یا خالی برای همه
		const result = await notificationService.markNotificationsAsRead(
			req.user.id,
			notificationIds
		);
		res.status(200).json({
			success: true,
			message: `${result.modifiedCount} اعلان به عنوان خوانده شده علامت‌گذاری شد.`,
		});
	} catch (error) {
		next(error);
	}
};

const deleteNotification = async (req, res, next) => {
	try {
		await notificationService.deleteNotification(req.params.id, req.user);

		// 204 No Content is the standard response for a successful deletion
		res.status(204).json(null);
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getNotifications,
	markAsRead,
	deleteNotification
};
