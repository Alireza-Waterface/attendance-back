const dashboardService = require("../services/dashboardService");

const getDashboardStats = async (req, res, next) => {
	try {
		const dashboardData = await dashboardService.getDashboardData(
			req.query
		);
		res.status(200).json({
			success: true,
			data: dashboardData,
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getDashboardStats,
};