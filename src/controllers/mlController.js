const mlService = require('../services/mlService');

const getClusters = async (req, res, next) => {
	try {
		const clusters = await mlService.getEmployeeClusters();
		res.status(200).json({ success: true, data: clusters });
	} catch (error) {
		next(error);
	}
};

const getAnomalies = async (req, res, next) => {
	try {
		const { date } = req.query; // تاریخ از کوئری پارامتر گرفته می‌شود
		const anomalies = await mlService.getDailyAnomalies(date);
		res.status(200).json({ success: true, data: anomalies });
	} catch (error) {
		next(error);
	}
};

module.exports = { getClusters, getAnomalies };