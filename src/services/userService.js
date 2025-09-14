// src/services/userService.js
const User = require("../models/User");
const Department = require("../models/Department");
const AppError = require("../utils/AppError");
const { createNotification } = require("./notificationService");
const Attendance = require("../models/Attendance");
const RefreshToken = require("../models/RefreshToken");
const moment = require("moment");
const fs = require("fs");
const path = require("path");

const logger = require("../config/logger");
const { default: mongoose } = require("mongoose");

const getUserProfile = async (userId) => {
	const user = await User.findById(userId).select("-password");
	if (!user) {
		throw new Error("کاربر یافت نشد.");
	}
	return user;
};

const createUser = async (userData) => {
	const {
		roles,
		personnelCode,
		nationalCode,
		departments: departmentNames,
	} = userData;

	const isStaffBased = roles.some((role) =>
		["کارمند", "مدیر", "مسئول"].includes(role)
	);
	const isFacultyBased = roles.some((role) =>
		["استاد", "هیات_علمی"].includes(role)
	);

	if (isStaffBased && !personnelCode) {
		throw new AppError(
			"برای نقش‌های کارمند، مدیر و مسئول، کد پرسنلی الزامی است.",
			400
		);
	}
	if (isFacultyBased && !nationalCode) {
		throw new AppError(
			"برای نقش‌های استاد و هیات علمی، کد ملی الزامی است.",
			400
		);
	}

	if (personnelCode === "") userData.personnelCode = undefined;
	if (nationalCode === "") userData.nationalCode = undefined;

	const orQueries = [];
	if (personnelCode) {
		orQueries.push({ personnelCode });
	}
	if (nationalCode) {
		orQueries.push({ nationalCode });
	}

	if (orQueries.length > 0) {
		const userExists = await User.findOne({ $or: orQueries });
		if (userExists) {
			let errorMessage = "کاربری با این مشخصات قبلاً ثبت شده است.";
			if (userExists.personnelCode === personnelCode) {
				errorMessage = "کاربری با این کد پرسنلی قبلاً ثبت شده است.";
			} else if (userExists.nationalCode === nationalCode) {
				errorMessage = "کاربری با این کد ملی قبلاً ثبت شده است.";
			}
			throw new AppError(errorMessage, 409); // 409 Conflict
		}
	}

	// ۳. ایجاد کاربر
	const { ...dataToCreate } = userData;

	if (departmentNames && departmentNames.length > 0) {
		const count = await Department.countDocuments({
			name: { $in: departmentNames },
		});
		if (count !== departmentNames.length) {
			throw new AppError("یک یا چند واحد انتخاب شده نامعتبر است.", 400);
		}
	}

	const user = await User.create({
		...dataToCreate,
		departments: departmentNames || [],
	});

	// حذف پسورد از آبجکت خروجی
	user.password = undefined;

	return user;
};

const updateUserProfile = async (userId, updateData) => {
	const user = await User.findById(userId);
	if (!user) {
		throw new AppError("کاربر یافت نشد.", 404);
	}

	const allowedUpdates = [
		"fullName",
		"roomLocation",
		"profileSettings",
		"phoneNumber",
		"nationalCode",
		"personnelCode",
	];

	const updatesToSet = {};
	const updatesToUnset = {};

	allowedUpdates.forEach((key) => {
		if (updateData[key] !== undefined) {
			if (updateData[key] === "") {
				updatesToUnset[key] = 1;
			} else {
				updatesToSet[key] = updateData[key];
			}
		}
	});

	if (
		Object.keys(updatesToSet).length === 0 &&
		Object.keys(updatesToUnset).length === 0
	) {
		return user;
	}

	const updateOperation = {};
	if (Object.keys(updatesToSet).length > 0) {
		updateOperation.$set = updatesToSet;
	}
	if (Object.keys(updatesToUnset).length > 0) {
		updateOperation.$unset = updatesToUnset;
	}

	const updatedUser = await User.findByIdAndUpdate(userId, updateOperation, {
		new: true,
		runValidators: true,
	}).select("-password");

	return updatedUser;
};

const getAllUsers = async (filters) => {
	const { page = 1, limit = 10, search, role, department } = filters;

	const query = {};

	if (department && department !== "all") query.departments = department;

	if (search) {
		query.$or = [
			{ fullName: { $regex: search, $options: "i" } },
			{ personnelCode: { $regex: search, $options: "i" } },
			{ nationalCode: { $regex: search, $options: "i" } },
		];
	}
	if (role) query.roles = role;

	const options = {
		page: parseInt(page, 10),
		limit: parseInt(limit, 10),
		select: "-password",
		sort: { createdAt: -1 },
	};

	const users = await User.paginate(query, options);
	return users;
};

const getUserById = async (userId) => {
	const user = await User.findById(userId).select("-password");
	if (!user) {
		throw new Error("کاربر یافت نشد.");
	}
	return user;
};

const updateUserById = async (userId, updateData, adminUser) => {
	// ۱. بررسی امنیتی: مدیر نمی‌تواند نقش "مدیر" را از خودش بگیرد
	if (
		adminUser.id === userId &&
		updateData.roles &&
		!updateData.roles.includes("مدیر")
	) {
		throw new Error(
			"شما نمی‌توانید نقش مدیریت را از حساب کاربری خود حذف کنید."
		);
	}

	// ۲. فیلدهایی که مدیر مجاز به ویرایش آن‌هاست
	const allowedUpdates = [
		"fullName",
		"roles",
		"departments",
		"roomLocation",
		"isActive",
		"personnelCode",
		"nationalCode",
		"phoneNumber",
	];
	const updates = {};
	Object.keys(updateData).forEach((key) => {
		if (allowedUpdates.includes(key)) {
			updates[key] = updateData[key];
		}
	});

	if (Object.keys(updates).length === 0) {
		throw new Error("هیچ اطلاعات معتبری برای به‌روزرسانی ارسال نشده است.");
	}

	if (updateData.departments) {
		const count = await Department.countDocuments({
			name: { $in: updateData.departments },
		});
		if (count !== updateData.departments.length) {
			throw new AppError("یک یا چند واحد انتخاب شده نامعتبر است.", 400);
		}
		updateData.departments = updateData.departments;
		delete updateData.departments;
	}

	const updatedUser = await User.findByIdAndUpdate(
		userId,
		{ $set: updates },
		{
			new: true,
			runValidators: true,
		}
	).select("-password");

	if (!updatedUser) {
		throw new Error("کاربر یافت نشد.");
	}

	await createNotification({
		recipient: userId,
		sender: adminUser.id,
		type: "PROFILE_UPDATED_BY_ADMIN",
		message: "اطلاعات پروفایل شما توسط مدیر ویرایش شد.",
		link: "/profile",
	});

	return updatedUser;
};

/**
 * Updates a user's avatar, and deletes the old one.
 * @param {string} userId - The ID of the user.
 * @param {object} file - The file object from multer.
 */
const updateUserAvatar = async (userId, file) => {
	if (!file) {
		throw new AppError("فایلی برای آپلود انتخاب نشده است.", 400);
	}

	const user = await User.findById(userId);
	if (!user) {
		// If user not found, delete the uploaded file to prevent orphans
		fs.unlink(file.path, (err) => {
			if (err) console.error("Error deleting orphaned avatar:", err);
		});
		throw new AppError("کاربر یافت نشد.", 404);
	}

	// Delete the old avatar if it's not the default one
	const oldAvatarPath = user.avatar;
	const defaultAvatarPath = "uploads/default-avatar.webp";

	if (oldAvatarPath && oldAvatarPath !== defaultAvatarPath) {
		const fullOldPath = path.join(__dirname, "..", "..", oldAvatarPath);
		// Use fs.promises for cleaner async/await syntax
		fs.promises
			.unlink(fullOldPath)
			.catch((err) =>
				console.error(
					"Old avatar not found or could not be deleted:",
					err
				)
			);
	}

	// Format the path for API access (replace backslashes with forward slashes)
	const formattedPath = file.path.replace(/\\/g, "/");
	user.avatar = formattedPath;

	await user.save();

	// Return a user object without the password
	const updatedUser = await User.findById(userId).select("-password");
	return updatedUser;
};

/**
 * @param {string} userId - شناسه کاربری که باید حذف شود
 * @param {object} currentUser - کاربری که در حال انجام عملیات است (مدیر)
 */
const deleteUser = async (userId, currentUser) => {
	if (userId === currentUser.id.toString()) {
		throw new AppError("شما نمی‌توانید حساب کاربری خود را حذف کنید.", 400);
	}

	const userToDelete = await User.findById(userId);
	if (!userToDelete) {
		throw new AppError("کاربر مورد نظر یافت نشد.", 404);
	}

	await Attendance.deleteMany({ user: userId });

	await RefreshToken.deleteMany({ user: userId });

	await User.findByIdAndDelete(userId);
};

const getPublicUserList = async (filters) => {
	const { search, page = 1, limit = 10, date } = filters;
	const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

	if (!date) {
		throw new AppError(
			"A date parameter in YYYY/MM/DD format is required.",
			400
		);
	}

	const aggregationPipeline = [];

	const matchStage = { isActive: true };
	if (search) {
		matchStage.$or = [{ fullName: { $regex: search, $options: "i" } }];
	}
	aggregationPipeline.push({ $match: matchStage });

	aggregationPipeline.push({
		$facet: {
			metadata: [{ $count: "totalDocs" }],
			docs: [
				{ $sort: { fullName: 1 } },
				{ $skip: skip },
				{ $limit: parseInt(limit, 10) },

				{
					$lookup: {
						from: "attendances",
						let: { userId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$user", "$$userId"] },
											{ $eq: ["$date", date] },
										],
									},
								},
							},
							{ $sort: { createdAt: -1 } },
							{ $limit: 1 },
						],
						as: "todayAttendance",
					},
				},
				{
					$unwind: {
						path: "$todayAttendance",
						preserveNullAndEmptyArrays: true,
					},
				},
				// --- Finally, project the public fields ---
				{
					$project: {
						_id: 1,
						fullName: 1,
						avatar: 1,
						roomLocation: 1,
						phoneNumber: {
							$cond: {
								if: {
									$eq: [
										"$profileSettings.isPhoneNumberPublic",
										true,
									],
								},
								then: "$phoneNumber",
								else: "$$REMOVE",
							},
						},
						presenceStatus: {
							$cond: {
								if: {
									$and: [
										{
											$ifNull: [
												"$todayAttendance.checkIn",
												false,
											],
										},
										{
											$eq: [
												"$todayAttendance.checkOut",
												null,
											],
										},
									],
								},
								then: "حاضر در دانشگاه",
								else: "خارج از دانشگاه",
							},
						},
					},
				},
			],
		},
	});

	const result = await User.aggregate(aggregationPipeline);

	if (!result[0]) {
		return {
			docs: [],
			totalDocs: 0,
			limit,
			page: parseInt(page, 10),
			totalPages: 0,
		};
	}

	const docs = result[0].docs;
	const totalDocs = result[0].metadata[0]
		? result[0].metadata[0].totalDocs
		: 0;

	return {
		docs,
		totalDocs,
		limit: parseInt(limit, 10),
		page: parseInt(page, 10),
		totalPages: Math.ceil(totalDocs / parseInt(limit, 10)),
		hasNextPage: parseInt(page, 10) < Math.ceil(totalDocs / limit),
		hasPrevPage: parseInt(page, 10) > 1,
	};
};

/**
 * Searches ALL active users for selection lists, accessible by Admins and Officers.
 * @param {string} searchTerm - The term to search for.
 */
const searchUsersForSelection = async (searchTerm) => {
	if (!searchTerm || searchTerm.trim().length < 2) {
		return [];
	}

	const searchRegex = new RegExp(searchTerm, "i");

	const query = {
		$and: [
			{ isActive: true },
			{
				$or: [
					{ fullName: searchRegex },
					{ personnelCode: searchRegex },
					{ nationalCode: searchRegex },
				],
			},
		],
	};

	const users = await User.find(query)
		.sort({ fullName: 1 })
		.limit(10)
		.select("_id fullName personnelCode nationalCode");

	return users;
};

module.exports = {
	getUserProfile,
	createUser,
	updateUserProfile,
	getAllUsers,
	getUserById,
	updateUserById,
	updateUserAvatar,
	deleteUser,
	getPublicUserList,
	searchUsersForSelection,
};
