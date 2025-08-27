// src/controllers/userController.js
const userService = require("../services/userService");
const catchAsync = require("../utils/catchAsync");

const getMyProfile = catchAsync(async (req, res, next) => {
	const user = await userService.getUserProfile(req.user.id);
	res.status(200).json({
		success: true,
		data: user,
	});
});

// کنترلر جدید برای ایجاد کاربر
const createUser = catchAsync(async (req, res, next) => {
	const user = await userService.createUser(req.body);
	res.status(201).json({
		success: true,
		message: "کاربر جدید با موفقیت ایجاد شد.",
		data: user,
	});
});

const updateMyProfile = catchAsync(async (req, res, next) => {
	try {
		// req.user.id comes from the 'protect' middleware
		const updatedUser = await userService.updateUserProfile(
			req.user.id,
			req.body
		);
		res.status(200).json({
			success: true,
			message: "پروفایل با موفقیت به‌روزرسانی شد.",
			data: updatedUser,
		});
	} catch (error) {
		next(error);
	}
});

const getAllUsers = catchAsync(async (req, res, next) => {
	const users = await userService.getAllUsers(req.query);
	res.status(200).json({ success: true, data: users });
});

const getUserById = catchAsync(async (req, res, next) => {
	const user = await userService.getUserById(req.params.id);
	res.status(200).json({ success: true, data: user });
});

const updateUser = catchAsync(async (req, res, next) => {
	const updatedUser = await userService.updateUserById(
		req.params.id,
		req.body,
		req.user
	);
	res.status(200).json({
		success: true,
		message: "اطلاعات کاربر با موفقیت به‌روزرسانی شد.",
		data: updatedUser,
	});
});

const uploadAvatar = async (req, res, next) => {
	try {
		// req.file توسط middleware multer به درخواست اضافه می‌شود
		const user = await userService.updateUserAvatar(req.user.id, req.file);

		res.status(200).json({
			success: true,
			message: "عکس پروفایل با موفقیت آپلود شد.",
			data: user, // Send back the full updated user
		});
	} catch (error) {
		// errorHandler ما خطاها را مدیریت خواهد کرد
		next(error);
	}
};

const deleteUser = async (req, res, next) => {
	try {
		await userService.deleteUser(req.params.id, req.user);

		// پاسخ 204 No Content بهترین پاسخ برای یک عملیات حذف موفق است.
		// این پاسخ هیچ بدنه‌ای (body) ندارد.
		res.status(204).json(null);
	} catch (error) {
		next(error);
	}
};

const getPublicUsers = async (req, res, next) => {
	try {
		const usersData = await userService.getPublicUserList(req.query);

		res.status(200).json({
			success: true,
			data: usersData,
		});
	} catch (error) {
		next(error);
	}
};

const searchUsers = async (req, res, next) => {
	try {
		const searchTerm = req.query.search || "";
		const users = await userService.searchUsersForSelection(searchTerm);
		res.status(200).json({ success: true, data: users });
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getMyProfile,
	createUser,
	updateMyProfile,
	getAllUsers,
	getUserById,
	updateUser,
	uploadAvatar,
	deleteUser,
	getPublicUsers,
	searchUsers
};
