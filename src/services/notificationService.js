const Notification = require("../models/Notification");
const AppError = require("../utils/AppError");

/**
 * یک اعلان جدید برای یک کاربر ایجاد می‌کند
 * @param {object} data - داده‌های اعلان
 * @param {string} data.recipient - شناسه کاربر گیرنده
 * @param {string} data.type - نوع اعلان
 * @param {string} data.message - متن پیام
 * @param {string} [data.sender] - شناسه کاربر فرستنده (اختیاری)
 * @param {string} [data.link] - لینک مرتبط (اختیاری)
 */
const createNotification = async (data) => {
	try {
		await Notification.create(data);
	} catch (error) {
		// در صورت خطا، فقط آن را لاگ می‌کنیم و برنامه را متوقف نمی‌کنیم
		// چون ایجاد نشدن اعلان نباید جلوی عملیات اصلی را بگیرد
		console.error("Error creating notification:", error);
	}
};

/**
 * دریافت اعلان‌های یک کاربر با صفحه‌بندی
 */
const getUserNotifications = async (userId, filters) => {
	const { status = "all" } = filters;

	const query = { recipient: userId };
	if (status === "unread") {
		query.isRead = false;
	} else if (status === "read") {
		query.isRead = true;
	} else if (status !== "all") {
		throw new AppError("فیلتر ارسالی نامعتبر می‌باشد", 400);
	}

	const options = {
		sort: { createdAt: -1 },
	};

	return await Notification.paginate(query, options);
};

/**
 * علامت‌گذاری یک یا چند اعلان به عنوان "خوانده شده"
 */
const markNotificationsAsRead = async (userId, notificationIds) => {
	// اگر notificationIds ارسال نشده بود، همه اعلان‌های خوانده نشده را آپدیت کن
	const query = { recipient: userId, isRead: false };
	if (notificationIds && notificationIds.length > 0) {
		query._id = { $in: notificationIds };
	}

	const result = await Notification.updateMany(query, {
		$set: { isRead: true },
	});

	return result;
};

/**
 * Deletes a single notification by its ID.
 * Ensures that only the recipient or an admin can delete it.
 * @param {string} notificationId - The ID of the notification to delete.
 * @param {object} currentUser - The user performing the action.
 */
const deleteNotification = async (notificationId, currentUser) => {
	const notification = await Notification.findById(notificationId);

	// 1. Check if the notification exists
	if (!notification) {
		// It's good practice to not throw an error if the resource is already gone.
		// This prevents errors if the user clicks delete twice quickly.
		return;
	}

	// 2. Authorization Check
	const isRecipient =
		notification.recipient.toString() === currentUser._id.toString();
	const isAdmin = currentUser.roles.includes("مدیر");

	if (!isRecipient && !isAdmin) {
		throw new AppError("شما اجازه حذف این اعلان را ندارید.", 403); // 403 Forbidden
	}

	// 3. Delete the notification
	await Notification.findByIdAndDelete(notificationId);
};

module.exports = {
	createNotification,
	getUserNotifications,
	markNotificationsAsRead,
  deleteNotification
};
