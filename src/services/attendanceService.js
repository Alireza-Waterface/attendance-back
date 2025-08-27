// src/services/attendanceService.js
const moment = require("moment-jalaali");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { ATTENDANCE_STATUS } = require("../config/constants");
const { ROLES } = require("../config/constants");
const { createNotification } = require("./notificationService");
const { appSettings } = require("../middleware/settingsLoader");
const AppError = require("../utils/AppError");
const { default: mongoose } = require("mongoose");

const recordAttendance = async (data) => {
	const { userId, type, recordedById, timestamp } = data;

	const user = await User.findById(userId);
	if (!user) {
		throw new Error("کاربر مورد نظر یافت نشد.");
	}

	const todayJalali = moment(
		timestamp ? new Date(timestamp) : new Date()
	).format("jYYYY/jMM/jDD");

	let attendanceRecord = await Attendance.findOne({
		user: userId,
		date: todayJalali,
	});

	const now = timestamp ? new Date(timestamp) : new Date();

	if (type === "check-in") {
		if (attendanceRecord && attendanceRecord.checkIn) {
			throw new Error("ورود برای این کاربر امروز قبلاً ثبت شده است.");
		}

		if (!attendanceRecord) {
			attendanceRecord = new Attendance({
				user: userId,
				date: todayJalali,
				recordedBy: recordedById,
			});
		}

		attendanceRecord.checkIn = now;
		attendanceRecord.checkOut = null;

		// ۴. تعیین وضعیت (تاخیر یا حاضر) بر اساس ساعت کاری در .env
		const isStaff = user.roles.some((role) =>
			[ROLES.ADMIN, ROLES.OFFICER, ROLES.STAFF].includes(role)
		);

		// 3. Get the late threshold from settings
		const lateThreshold = moment(appSettings.lateThresholdTime, "HH:mm");

		// 4. Determine status based on role and time
		if (isStaff && moment(now).isAfter(lateThreshold)) {
			// If they are staff AND they are late, set status to 'تاخیر'
			attendanceRecord.status = ATTENDANCE_STATUS.LATE;
		} else {
			// For everyone else (faculty, or staff who are on time), set status to 'حاضر'
			attendanceRecord.status = ATTENDANCE_STATUS.PRESENT;
		}
	} else if (type === "check-out") {
		// اگر رکوردی برای امروز وجود نداشت یا ورود ثبت نشده بود، خطا بده
		if (!attendanceRecord || !attendanceRecord.checkIn) {
			throw new Error("برای ثبت خروج، ابتدا باید ورود ثبت شود.");
		}

		// اگر خروج قبلاً ثبت شده بود، خطا بده
		if (attendanceRecord.checkOut) {
			throw new Error("خروج برای این کاربر امروز قبلاً ثبت شده است.");
		}

		attendanceRecord.checkOut = now;
		attendanceRecord.lastEditedBy = recordedById;
	} else {
		throw new Error("نوع عملیات نامعتبر است. (فقط check-in یا check-out)");
	}

	await attendanceRecord.save();

	return {
		_id: attendanceRecord._id,
		user: attendanceRecord.user.toString(), // Convert the ObjectId to a string
		type: type, // The frontend might need this
		checkIn: attendanceRecord.checkIn,
		checkOut: attendanceRecord.checkOut,
	};
};

/**
 * Fetches the logged-in user's own attendance records using an aggregation pipeline for precise data shaping.
 * @param {string} userId - The ID of the logged-in user.
 * @param {object} queryOptions - { page, limit, startDate, endDate }
 */
const getMyAttendanceRecords = async (userId, queryOptions) => {
	const {
		startDate,
		endDate,
		page = 1,
		limit = 10,
		status,
		isJustified,
	} = queryOptions;
	const pageInt = parseInt(page, 10);
	const limitInt = parseInt(limit, 10);
	const skip = (pageInt - 1) * limitInt;

	const matchStage = { user: new mongoose.Types.ObjectId(userId) };
	if (startDate && endDate) {
		matchStage.date = { $gte: startDate, $lte: endDate };
	}

	if (status && status !== "all") {
		matchStage.status = status;
	}
	if (isJustified !== undefined && isJustified !== "all") {
		matchStage.isJustified = isJustified === "true";
	}

	const aggregationPipeline = [
		{ $match: matchStage },
		{ $sort: { date: -1, createdAt: -1 } },

		{
			$facet: {
				metadata: [{ $count: "totalDocs" }],
				docs: [
					{ $skip: skip },
					{ $limit: limitInt },

					{
						$lookup: {
							from: "users",
							localField: "recordedBy",
							foreignField: "_id",
							as: "recordedByInfo",
						},
					},

					{
						$unwind: {
							path: "$recordedByInfo",
							preserveNullAndEmptyArrays: true,
						},
					},

					{
						$project: {
							_id: 1,
							date: 1,
							checkIn: 1,
							checkOut: 1,
							status: 1,
							isJustified: 1,
							justificationNotes: 1,
							recordedBy: {
								_id: { $ifNull: ["$recordedByInfo._id", null] },
								fullName: {
									$ifNull: [
										"$recordedByInfo.fullName",
										"سیستم",
									],
								},
								personnelCode: {
									$ifNull: [
										"$recordedByInfo.personnelCode",
										null,
									],
								},
							},
						},
					},
				],
			},
		},
	];

	const result = await Attendance.aggregate(aggregationPipeline);

	const docs = result[0]?.docs || [];
	const totalDocs = result[0]?.metadata[0]?.totalDocs || 0;
	const totalPages = Math.ceil(totalDocs / limitInt);

	return {
		docs,
		totalDocs,
		limit: limitInt,
		page: pageInt,
		totalPages,
		hasNextPage: pageInt < totalPages,
		hasPrevPage: pageInt > 1,
	};
};

const updateAttendanceRecord = async (recordId, updateData, currentUser) => {
	// ۱. پیدا کردن رکورد مورد نظر
	const record = await Attendance.findById(recordId)
		.populate("user", "fullName roles") // اطلاعات کاربر اصلی را می‌گیریم
		.populate("recordedBy", "fullName"); // اطلاعات ثبت‌کننده را می‌گیریم

	if (!record) {
		throw new Error("رکورد حضور و غیاب یافت نشد.");
	}

	const isAdmin = currentUser.roles.includes(ROLES.ADMIN);
	const isOfficer = currentUser.roles.includes(ROLES.OFFICER);

	const changes = {};

	// For each potential field, check if it was sent and if it's different from the DB value.

	// Check checkIn
	if (
		updateData.checkIn &&
		new Date(updateData.checkIn).toISOString() !==
			record.checkIn?.toISOString()
	) {
		changes.checkIn = updateData.checkIn;
	}
	// Check checkOut
	if (
		updateData.checkOut &&
		new Date(updateData.checkOut).toISOString() !==
			record.checkOut?.toISOString()
	) {
		changes.checkOut = updateData.checkOut;
	} else if (updateData.checkOut === null && record.checkOut !== null) {
		// Handle clearing the checkout time
		changes.checkOut = null;
	}
	// Check status
	if (updateData.status && updateData.status !== record.status) {
		changes.status = updateData.status;
	}
	// ... Add isJustified and justificationNotes if needed for admin ...

	if (!isAdmin && isOfficer) {
		// Now, apply rules ONLY to the fields in the 'changes' object.
		const timeLimit = appSettings.officerEditTimeLimit;
		const now = moment();

		if (changes.checkIn) {
			if (record.recordedBy?.toString() !== currentUser._id.toString()) {
				throw new AppError(
					"شما فقط مجاز به ویرایش زمان ورودی هستید که خودتان ثبت کرده‌اید.",
					403
				);
			}
			if (
				moment(record.createdAt).add(timeLimit, "minutes").isBefore(now)
			) {
				throw new AppError(
					`زمان مجاز برای ویرایش ورود (${timeLimit} دقیقه) به پایان رسیده است.`,
					400
				);
			}
		}

		if (changes.checkOut) {
			if (
				record.checkOut &&
				record.lastEditedBy?.toString() !== currentUser._id.toString()
			) {
				throw new AppError(
					"شما فقط مجاز به ویرایش زمان خروجی هستید که خودتان ثبت کرده‌اید.",
					403
				);
			}
			if (
				record.checkOut &&
				moment(record.updatedAt).add(timeLimit, "minutes").isBefore(now)
			) {
				throw new AppError(
					`زمان مجاز برای ویرایش خروج (${timeLimit} دقیقه) به پایان رسیده است.`,
					400
				);
			}
		}

		// Admin-only fields
		if (updateData.isJustified || updateData.justificationNotes) {
			throw new AppError(
				"شما دسترسی لازم برای موجه کردن رکورد را ندارید.",
				403
			);
		}
	} else if (!isAdmin) {
		throw new AppError(
			"شما دسترسی لازم برای انجام این عملیات را ندارید.",
			403
		);
	}
	// --- >> END OF CORRECTED LOGIC << ---

	// If there are no actual changes, we can stop here.
	if (
		Object.keys(changes).length === 0 &&
		!updateData.isJustified &&
		!updateData.justificationNotes
	) {
		return record; // Return the original record if nothing changed
	}

	// For admin updates, merge the changes back in
	const finalUpdateData = { ...changes };
	if (isAdmin) {
		if (updateData.isJustified !== undefined)
			finalUpdateData.isJustified = updateData.isJustified;
		if (updateData.justificationNotes !== undefined)
			finalUpdateData.justificationNotes = updateData.justificationNotes;
	}

	// History and update logic
	// ...
	if (finalUpdateData.checkOut !== undefined) {
		record.lastEditedBy = currentUser._id;
	}

	Object.assign(record, finalUpdateData);

	// ۳. ثبت تاریخچه ویرایش (بسیار مهم برای حسابرسی)
	const previousState = {
		checkIn: record.checkIn,
		checkOut: record.checkOut,
		status: record.status,
		isJustified: record.isJustified,
	};

	record.editHistory.push({
		editor: currentUser._id,
		timestamp: new Date(),
		previousState,
	});

	// ۴. اعمال تغییرات
	Object.assign(record, updateData);
	record.lastEditedBy = currentUser._id;

	await record.save();

	if (isAdmin && record.user._id.toString() !== currentUser._id.toString()) {
		let message;
		let type = "ATTENDANCE_UPDATED";

		if (updateData.isJustified === true) {
			message = `تاخیر/غیبت شما برای تاریخ ${record.date} توسط مدیر (${currentUser.fullName}) موجه شد.`;
			type = "ATTENDANCE_JUSTIFIED";
		} else {
			message = `رکورد حضور و غیاب شما برای تاریخ ${record.date} توسط مدیر (${currentUser.fullName}) ویرایش شد.`;
		}

		await createNotification({
			recipient: record.user._id,
			sender: currentUser._id,
			type: type,
			message: message,
			link: `/my-records?date=${record.date}`, // یک لینک بهتر برای فرانت‌اند
		});
	}

	return record;
};

const getRecordsByRecorderToday = async ({ recorderId, sortBy, role }) => {
	const todayJalali = moment().format("jYYYY/jMM/jDD");

	let sortOption = { createdAt: -1 };
	if (sortBy === "createdAt-asc") sortOption = { createdAt: 1 };

	const aggregationPipeline = [
		{ $match: { date: todayJalali } },
		{ $sort: sortOption },
		{
			$lookup: {
				from: "users",
				localField: "user",
				foreignField: "_id",
				as: "userInfo",
			},
		},
		{ $unwind: "$userInfo" },
	];

	if (role && role !== "all") {
		aggregationPipeline.push({
			$match: { "userInfo.roles": role },
		});
	}

	aggregationPipeline.push({
		$project: {
			_id: 1,
			checkIn: 1,
			checkOut: 1,
			status: 1,
			isJustified: 1,
			user: {
				_id: "$userInfo._id",
				fullName: "$userInfo.fullName",
				roles: "$userInfo.roles",
			},
		},
	});

	const records = await Attendance.aggregate(aggregationPipeline);
	return records;
};

const deleteAttendanceRecord = async (recordId, currentUser) => {
	const record = await Attendance.findById(recordId);
	if (!record) throw new AppError("رکورد یافت نشد.", 404);

	const isAdmin = currentUser.roles.includes("مدیر");
	const isOwner = record.recordedBy.toString() === currentUser.id.toString();

	if (!isAdmin && !isOwner) {
		throw new AppError("شما اجازه حذف این رکورد را ندارید.", 403);
	}

	await Attendance.findByIdAndDelete(recordId);
};

module.exports = {
	recordAttendance,
	getMyAttendanceRecords,
	updateAttendanceRecord,
	getRecordsByRecorderToday,
	deleteAttendanceRecord,
};
