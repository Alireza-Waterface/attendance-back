const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const moment = require("moment-jalaali");
const Department = require("../models/Department");
const User = require("../models/User");
const { PERFORMANCE_SCORE, ROLES } = require("../config/constants");

const getComprehensiveReport = async (filters, currentUser) => {
	const {
		userId,
		department,
		startDate,
		endDate,
		status,
		sortBy = "date-desc",
		recordedById,
		userRole,
		page = 1,
		limit = 10,
		isJustified,
		export: exportToExcel, // پارامتر جدید برای خروجی اکسل
	} = filters;

	const aggregationPipeline = [];
	const matchStage = {};

	// ۱. منطق دسترسی مبتنی بر نقش
	// اگر کاربر مسئول است، فقط رکوردهایی را نشان بده که خودش ثبت کرده
	if (
		currentUser.roles.includes(ROLES.OFFICER) &&
		!currentUser.roles.includes(ROLES.ADMIN)
	) {
		matchStage.$or = [
      { recordedBy: currentUser._id },
      { 'editHistory.editor': currentUser._id }
    ];
	}

	// ۲. اعمال فیلترهای اصلی
	if (startDate && endDate)
		matchStage.date = { $gte: startDate, $lte: endDate };
	if (status) matchStage.status = status;
	if (isJustified !== undefined && isJustified !== "all") {
		matchStage.isJustified = isJustified === "true"; // تبدیل رشته به boolean
	}
	if (userId) matchStage.user = new mongoose.Types.ObjectId(userId);
	if (recordedById)
		matchStage.recordedBy = new mongoose.Types.ObjectId(recordedById);

	// اضافه کردن فیلترهای اصلی به پایپ‌لاین
	aggregationPipeline.push({ $match: matchStage });

	// ۳. پیوستن (Join) به اطلاعات کاربران برای فیلتر و نمایش
	// Join با کاربر صاحب گزارش (user)
	aggregationPipeline.push({
		$lookup: {
			from: "users",
			localField: "user",
			foreignField: "_id",
			as: "user",
		},
	});
	// Join با مسئول ثبت‌کننده (recordedBy)
	aggregationPipeline.push({
		$lookup: {
			from: "users",
			localField: "recordedBy",
			foreignField: "_id",
			as: "recordedBy",
		},
	});

	// تبدیل آرایه‌ها به آبجکت
	aggregationPipeline.push({ $unwind: "$user" });
	aggregationPipeline.push({
		$unwind: { path: "$recordedBy", preserveNullAndEmptyArrays: true },
	}); // preserve... برای رکوردهایی که شاید ثبت‌کننده نداشته باشند

	// ۴. اعمال فیلتر بر اساس نقش کاربر (userRole)
	if (userRole && userRole !== "all") {
		aggregationPipeline.push({ $match: { "user.roles": userRole } });
	}

	if (department && department !== "all") {
		aggregationPipeline.push({
			$match: { "user.departments": department },
		});
	}

	aggregationPipeline.push({
		$project: {
			_id: 1,
			date: 1,
			status: 1,
			checkIn: 1,
			checkOut: 1,
			isJustified: 1,
			justificationNotes: 1,
			createdAt: 1,
			updatedAt: 1,
			editHistory: 1,
			lastEditedBy: 1,
			user: {
				avatar: 1,
				fullName: 1,
				nationalCode: 1,
				personnelCode: 1,
				_id: 1,
			},
			recordedBy: {
				avatar: 1,
				fullName: 1,
				nationalCode: 1,
				personnelCode: 1,
				_id: 1,
			},
		},
	});

	// ۵. منطق مرتب‌سازی
	let sortStage = {};
	if (sortBy === "date-desc") sortStage = { date: -1, createdAt: -1 };
	if (sortBy === "date-asc") sortStage = { date: 1, createdAt: 1 };
	aggregationPipeline.push({ $sort: sortStage });

	if (exportToExcel === "true") {
		const result = await Attendance.aggregate(aggregationPipeline);
		return result;
	}

	// ۶. صفحه‌بندی
	const pageInt = parseInt(page, 10);
	const limitInt = parseInt(limit, 10);

	const facetStage = {
		$facet: {
			metadata: [{ $count: "totalDocs" }],
			docs: [{ $skip: (pageInt - 1) * limitInt }, { $limit: limitInt }],
		},
	};
	aggregationPipeline.push(facetStage);

	const result = await Attendance.aggregate(aggregationPipeline);

	const docs = result[0].docs;
	const totalDocs = result[0].metadata[0]
		? result[0].metadata[0].totalDocs
		: 0;
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

/**
 * ۱. محاسبه میانگین ساعات کاری و آمار کلی برای یک کارمند در یک بازه زمانی
 */
const getUserMonthlyStats = async (userId, filters) => {
	const { year, month } = filters; // سال و ماه شمسی (مثال: year=1403, month=5)

	// تعیین تاریخ شروع و پایان ماه شمسی
	const startDate = moment(`${year}/${month}/01`, "jYYYY/jMM/jDD")
		.startOf("jMonth")
		.format("jYYYY/jMM/jDD");
	const endDate = moment(`${year}/${month}/01`, "jYYYY/jMM/jDD")
		.endOf("jMonth")
		.format("jYYYY/jMM/jDD");

	const stats = await Attendance.aggregate([
		// فیلتر کردن رکوردهای کاربر در بازه زمانی مشخص
		{
			$match: {
				user: new mongoose.Types.ObjectId(userId),
				date: { $gte: startDate, $lte: endDate },
				checkIn: { $exists: true }, // فقط رکوردهایی که ورود و خروج دارند
				checkOut: { $exists: true },
			},
		},
		// محاسبه مدت زمان حضور برای هر رکورد (به ساعت)
		{
			$project: {
				workDuration: {
					$divide: [
						{ $subtract: ["$checkOut", "$checkIn"] },
						1000 * 60 * 60, // تبدیل میلی‌ثانیه به ساعت
					],
				},
				status: 1,
			},
		},
		// گروه‌بندی تمام رکوردها و محاسبه آمار کلی
		{
			$group: {
				_id: null, // گروه‌بندی همه با هم
				averageWorkHours: { $avg: "$workDuration" },
				totalWorkHours: { $sum: "$workDuration" },
				totalDaysPresent: { $sum: 1 },
				totalLates: {
					$sum: { $cond: [{ $eq: ["$status", "تاخیر"] }, 1, 0] },
				},
			},
		},
		// فرمت نهایی خروجی
		{
			$project: {
				_id: 0,
				averageWorkHours: { $round: ["$averageWorkHours", 2] },
				totalWorkHours: { $round: ["$totalWorkHours", 2] },
				totalDaysPresent: 1,
				totalLates: 1,
			},
		},
	]);

	return (
		stats[0] || {
			averageWorkHours: 0,
			totalWorkHours: 0,
			totalDaysPresent: 0,
			totalLates: 0,
		}
	);
};

/**
 * ۲. روند تاخیرها در یک واحد خاص در طول زمان (روز به روز)
 */
const getDepartmentLateTrend = async (departmentId, filters) => {
	const { startDate, endDate } = filters;

	const trend = await User.aggregate([
		// پیدا کردن کاربران واحد مشخص
		{ $match: { departments: new mongoose.Types.ObjectId(departmentId) } },
		// پیوستن (join) به رکوردهای حضور و غیاب
		{
			$lookup: {
				from: "attendances",
				localField: "_id",
				foreignField: "user",
				as: "attendanceRecords",
			},
		},
		{ $unwind: "$attendanceRecords" },
		// فیلتر کردن رکوردهای حضور و غیاب بر اساس تاریخ و وضعیت تاخیر
		{
			$match: {
				"attendanceRecords.date": { $gte: startDate, $lte: endDate },
				"attendanceRecords.status": "تاخیر",
			},
		},
		// گروه‌بندی بر اساس تاریخ و شمارش تاخیرها در هر روز
		{
			$group: {
				_id: "$attendanceRecords.date", // گروه‌بندی بر اساس روز
				lateCount: { $sum: 1 },
			},
		},
		// فرمت نهایی خروجی
		{
			$project: {
				_id: 0,
				date: "$_id",
				lateCount: 1,
			},
		},
		// مرتب‌سازی بر اساس تاریخ
		{ $sort: { date: 1 } },
	]);

	return trend;
};

/**
 * ۳. مقایسه عملکرد حضور و غیاب بین واحدهای مختلف
 */
const compareDepartmentPerformance = async (filters) => {
	const { startDate, endDate } = filters;

	const performance = await Department.aggregate([
		// پیوستن به کاربران هر واحد
		{
			$lookup: {
				from: "users",
				localField: "_id",
				foreignField: "departments",
				as: "members",
			},
		},
		// فقط واحدهایی که عضو دارند
		{ $match: { "members.0": { $exists: true } } },
		// پیوستن به رکوردهای حضور و غیاب اعضا
		{
			$lookup: {
				from: "attendances",
				localField: "members._id",
				foreignField: "user",
				as: "attendanceRecords",
			},
		},
		// فرمت‌دهی نهایی و محاسبه آمار
		{
			$project: {
				_id: 0,
				department: "$name",
				totalMembers: { $size: "$members" },
				// فیلتر کردن رکوردهای حضور و غیاب در بازه زمانی
				filteredAttendance: {
					$filter: {
						input: "$attendanceRecords",
						as: "rec",
						cond: {
							$and: [
								{ $gte: ["$$rec.date", startDate] },
								{ $lte: ["$$rec.date", endDate] },
							],
						},
					},
				},
			},
		},
		{
			$project: {
				department: 1,
				totalMembers: 1,
				totalLates: {
					$size: {
						$filter: {
							input: "$filteredAttendance",
							as: "rec",
							cond: { $eq: ["$$rec.status", "تاخیر"] },
						},
					},
				},
				totalPresents: {
					$size: "$filteredAttendance", // تعداد کل رکوردهای حضور
				},
			},
		},
		// محاسبه نرخ تاخیر
		{
			$project: {
				department: 1,
				totalMembers: 1,
				totalLates: 1,
				lateRate: {
					$cond: [
						{ $eq: ["$totalPresents", 0] },
						0, // جلوگیری از تقسیم بر صفر
						{
							$round: [
								{ $divide: ["$totalLates", "$totalPresents"] },
								4,
							],
						},
					],
				},
			},
		},
		{ $sort: { lateRate: -1 } }, // مرتب‌سازی بر اساس بیشترین نرخ تاخیر
	]);

	return performance;
};

/**
 * ۴. محاسبه کارت امتیازی عملکرد حضور برای کاربران
 */
const getAttendanceScorecard = async (filters) => {
	const { startDate, endDate, userId, departmentId } = filters;

	// --- بخش اول: ساخت کوئری پایه برای پیدا کردن کاربران مورد نظر ---
	const userMatchQuery = {};
	if (userId) userMatchQuery._id = new mongoose.Types.ObjectId(userId);
	if (departmentId)
		userMatchQuery.departments = new mongoose.Types.ObjectId(departmentId);
	// فقط کارمندان فعال را در نظر می‌گیریم
	userMatchQuery.isActive = true;

	const scorecard = await User.aggregate([
		{ $match: userMatchQuery },
		// پیوستن به رکوردهای حضور و غیاب در بازه زمانی مشخص
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
									{ $gte: ["$date", startDate] },
									{ $lte: ["$date", endDate] },
								],
							},
						},
					},
				],
				as: "attendanceRecords",
			},
		},
		// محاسبه آمار اولیه برای هر کاربر
		{
			$project: {
				_id: 1,
				fullName: 1,
				personnelCode: 1,
				nationalCode: 1,
				// شمارش تعداد تاخیرها
				totalLates: {
					$size: {
						$filter: {
							input: "$attendanceRecords",
							as: "rec",
							cond: { $eq: ["$$rec.status", "تاخیر"] },
						},
					},
				},
				// شمارش تعداد غیبت‌های غیرموجه
				totalAbsents: {
					$size: {
						$filter: {
							input: "$attendanceRecords",
							as: "rec",
							cond: {
								$and: [
									{ $eq: ["$$rec.status", "غایب"] },
									{ $eq: ["$$rec.isJustified", false] },
								],
							},
						},
					},
				},
				// محاسبه مجموع ساعات کاری
				totalWorkHours: {
					$sum: {
						$map: {
							input: "$attendanceRecords",
							as: "rec",
							in: {
								$cond: [
									{
										$and: [
											"$$rec.checkIn",
											"$$rec.checkOut",
										],
									},
									{
										$divide: [
											{
												$subtract: [
													"$$rec.checkOut",
													"$$rec.checkIn",
												],
											},
											1000 * 60 * 60,
										],
									},
									0,
								],
							},
						},
					},
				},
			},
		},
		// محاسبه امتیاز نهایی
		{
			$project: {
				_id: 1,
				fullName: 1,
				personnelCode: 1,
				nationalCode: 1,
				stats: {
					totalLates: "$totalLates",
					totalAbsents: "$totalAbsents",
					totalWorkHours: { $round: ["$totalWorkHours", 2] },
				},
				performanceScore: {
					$add: [
						PERFORMANCE_SCORE.BASE_SCORE,
						{
							$multiply: [
								"$totalLates",
								PERFORMANCE_SCORE.LATE_PENALTY,
							],
						},
						{
							$multiply: [
								"$totalAbsents",
								PERFORMANCE_SCORE.ABSENT_PENALTY,
							],
						},
					],
				},
			},
		},
		// مرتب‌سازی بر اساس کمترین امتیاز
		{ $sort: { performanceScore: 1 } },
	]);

	return scorecard;
};

module.exports = {
	getComprehensiveReport,
	getUserMonthlyStats,
	getDepartmentLateTrend,
	compareDepartmentPerformance,
	getAttendanceScorecard,
};
