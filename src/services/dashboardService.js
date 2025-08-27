const moment = require("moment-jalaali");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Department = require("../models/Department"); // Needed for comparisons
const mlService = require("./mlService"); // For ML insights
const { ROLES } = require("../config/constants");

// The rest of your dashboardService.js remains the same, as it correctly
// uses the startDate and endDate variables provided by this function.

// --- Private Helper Aggregation Functions ---

// A. Key Performance Indicators (KPIs)
const _getKpiStats = async (startDate, endDate) => {
	const stats = await Attendance.aggregate([
		{ $match: { createdAt: { $gte: startDate, $lte: endDate } } },
		{
			$facet: {
				totalRecords: [{ $count: "count" }],
				totalLates: [
					{ $match: { status: "تاخیر" } },
					{ $count: "count" },
				],
				totalJustified: [
					{ $match: { isJustified: true } },
					{ $count: "count" },
				],
				workHours: [
					{
						$match: {
							checkIn: { $exists: true },
							checkOut: { $exists: true },
						},
					},
					{
						$project: {
							duration: {
								$divide: [
									{ $subtract: ["$checkOut", "$checkIn"] },
									3600000,
								],
							},
						},
					},
					{ $group: { _id: null, avgHours: { $avg: "$duration" } } },
				],
			},
		},
	]);
	const staffRoles = [ROLES.STAFF, ROLES.ADMIN, ROLES.OFFICER];
	const totalStaff = await User.countDocuments({
		isActive: true,
		roles: { $in: staffRoles },
	});

	return {
		totalRecords: stats[0].totalRecords[0]?.count || 0,
		totalLates: stats[0].totalLates[0]?.count || 0,
		totalJustified: stats[0].totalJustified[0]?.count || 0,
		avgWorkHours: parseFloat(
			(stats[0].workHours[0]?.avgHours || 0).toFixed(2)
		),
		onTimePercentage:
			stats[0].totalRecords[0]?.count > 0
				? Math.round(
						((stats[0].totalRecords[0].count -
							(stats[0].totalLates[0]?.count || 0)) /
							stats[0].totalRecords[0].count) *
							100
				  )
				: 100,
		totalStaff,
	};
};

// B. Attendance Trend Chart Data
const _getAttendanceByDay = async (startDate, endDate) => {
	return Attendance.aggregate([
		{ $match: { createdAt: { $gte: startDate, $lte: endDate } } },
		{
			$group: {
				_id: "$date",
				// --- >> THE FIX IS HERE << ---
				// 'present' is any record that isn't 'تاخیر' (or other non-present statuses)
				present: {
					$sum: {
						$cond: [
							{
								$and: [
									{ $ne: ["$status", "تاخیر"] },
									{ $ne: ["$status", "غایب"] }, // Add any other non-present statuses here
								],
							},
							1,
							0,
						],
					},
				},
				// --- >> END OF FIX << ---
				late: {
					$sum: { $cond: [{ $eq: ["$status", "تاخیر"] }, 1, 0] },
				},
			},
		},
		{ $project: { _id: 0, date: "$_id", present: 1, late: 1 } },
		{ $sort: { date: 1 } },
	]);
};

// C. Department Performance (Simplified version of your reportService logic)
const _getDepartmentPerformance = async (startDate, endDate) => {
	return Attendance.aggregate([
		// 1. Start with the attendance records in the correct date range
		{
			$match: {
				createdAt: { $gte: startDate, $lte: endDate },
				status: "تاخیر", // Only care about late records for this aggregation
			},
		},
		// 2. Group them by user to count lates per user
		{
			$group: {
				_id: "$user",
				lateCount: { $sum: 1 },
			},
		},
		// 3. Lookup the user's details, including their departments
		{
			$lookup: {
				from: "users",
				localField: "_id",
				foreignField: "_id",
				as: "userInfo",
			},
		},
		{ $unwind: "$userInfo" },
		// 4. Unwind the departments array so we can group by each department
		{ $unwind: "$userInfo.departments" },
		// 5. Now, group by department name and sum the lates
		{
			$group: {
				_id: "$userInfo.departments", // Group by department name (e.g., "آموزش")
				totalLates: { $sum: "$lateCount" },
			},
		},
		// 6. --- >> THE FIX IS HERE << ---
		// Final formatting. We keep the grouped key (_id) and also create a clean 'name' field.
		{
			$project: {
				// Keep the original _id which is the department name
				_id: 1,
				// Also create a 'departmentName' field for clarity in the API and for the YAxis dataKey
				department: "$_id",
				totalLates: 1,
			},
		},
		// --- >> END OF FIX << ---
		{ $sort: { totalLates: -1 } },
		{ $limit: 5 }, // It's good practice to limit chart data
	]);
};

// D. Top & Risky Performers Lists
const _getPerformers = async (
	startDate,
	endDate,
	sortOrder,
	threshold = null
) => {
	const aggregationPipeline = [
		{ $match: { createdAt: { $gte: startDate, $lte: endDate } } },
		{
			$group: {
				_id: "$user",
				lateCount: {
					$sum: { $cond: [{ $eq: ["$status", "تاخیر"] }, 1, 0] },
				},
			},
		},
	];

	// --- >> NEW THRESHOLD LOGIC IS HERE << ---
	// Add a new $match stage to filter based on the threshold
	if (threshold !== null) {
		if (sortOrder === 1) {
			// For Top Performers (ascending), we want lates EQUAL to the threshold (e.g., 0)
			aggregationPipeline.push({
				$match: { lateCount: { $lte: threshold } },
			});
		} else if (sortOrder === -1) {
			// For Risky Performers (descending), we want lates GREATER THAN the threshold (e.g., > 2)
			aggregationPipeline.push({
				$match: { lateCount: { $gte: threshold } },
			});
		}
	}
	// --- >> END OF NEW LOGIC << ---

	aggregationPipeline.push(
		{ $sort: { lateCount: sortOrder } },
		{ $limit: 5 },
		{
			$lookup: {
				from: "users",
				localField: "_id",
				foreignField: "_id",
				as: "userInfo",
			},
		},
		{ $unwind: "$userInfo" },
		{
			$project: {
				_id: 0,
				userId: "$_id",
				fullName: "$userInfo.fullName",
				lateCount: 1,
			},
		}
	);

	return Attendance.aggregate(aggregationPipeline);
};

const _getDailyStatusLists = async () => {
	const todayJalali = moment().format("jYYYY/jMM/jDD");

	// 1. Get all attendance records for today
	const todayAttendance = await Attendance.find({
		date: todayJalali, // Using the date string is efficient here
	}).populate("user", "fullName roles");

	const lateUsers = [];
	const presentUserIds = new Set(); // Using a Set is efficient for lookups

	todayAttendance.forEach((record) => {
		presentUserIds.add(record.user._id.toString());
		// const isStaff = record.user.roles.some(role => [ROLES.OFFICER, ROLES.STAFF, ROLES.ADMIN].includes(role));
		if (record.status === "تاخیر") {
			lateUsers.push({
				userId: record.user._id,
				fullName: record.user.fullName,
				checkInTime: moment(record.checkIn).format("HH:mm"),
			});
		}
	});

	// 2. Find absent users (only staff members)
	// These are active staff who do NOT have an attendance record today.
	const staffRoles = [ROLES.STAFF, ROLES.ADMIN, ROLES.OFFICER];
	const absentUsers = await User.find({
		isActive: true,
		roles: { $in: staffRoles }, // Assuming 'اداری' is the role for staff who must be present
		_id: { $nin: Array.from(presentUserIds) }, // Find users NOT IN the present list
	}).select("fullName personnelCode");

	return { lateUsers, absentUsers };
};

// --- Main Service Function ---

const getDashboardData = async (filters) => {
	const { startDate: recievedStartDate, endDate: recievedEndDate } = filters;

	const startDate = new Date(recievedStartDate);
	const endDate = new Date(recievedEndDate);

	const TOP_PERFORMER_THRESHOLD = 1;
	const RISKY_PERFORMER_THRESHOLD = 3;

	// Run all aggregations in parallel for maximum efficiency
	const [
		kpiStats,
		attendanceByDay,
		departmentPerformance,
		topPerformers,
		riskyPerformers,
		dailyLists,
		anomalies,
		clusters,
	] = await Promise.all([
		_getKpiStats(startDate, endDate),
		_getAttendanceByDay(startDate, endDate),
		_getDepartmentPerformance(startDate, endDate),
		_getPerformers(startDate, endDate, 1, TOP_PERFORMER_THRESHOLD), // Top performers (lowest late count)
		_getPerformers(startDate, endDate, -1, RISKY_PERFORMER_THRESHOLD), // Risky performers (highest late count)
		_getDailyStatusLists(),
		mlService.getDailyAnomalies(moment().format("jYYYY/jMM/jDD")), // Anomalies for today
		mlService.getEmployeeClusters(), // Clusters are usually calculated over all time
	]);

	return {
		kpiStats,
		charts: {
			attendanceByDay,
			departmentPerformance,
		},
		lists: {
			topPerformers,
			riskyPerformers,
			lateUsers: dailyLists.lateUsers,
			absentUsers: dailyLists.absentUsers,
		},
		ml: {
			anomalies,
			clusters,
		},
	};
};

module.exports = {
	getDashboardData,
};
