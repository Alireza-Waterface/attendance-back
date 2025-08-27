// src/controllers/reportController.js
const reportService = require('../services/reportService');
const excelService = require('../services/excelService');
const moment = require('moment-jalaali');

// این تابع خودِ کنترلر است
const getComprehensiveReport = async (req, res, next) => {
  try {
    const reportData = await reportService.getComprehensiveReport(req.query, req.user);

    // بررسی اینکه آیا خروجی اکسل درخواست شده است؟
    if (req.query.export === 'true') {
      if(!Array.isArray(reportData)) {
        console.log('Export failed: reportService did not return an array for export');
        throw new Error('داده‌های گزارش برای تولید فایل اکسل فرمت صحیح ندارند');
      }
      if(!reportData.length) {
        return res.status(404).json({ success: false, message: 'داده‌ای برای تولید گزارش اکسل یافت نشد' });
      }
      
      const buffer = await excelService.generateAttendanceExcel(reportData);
      
      const fileName = `Attendance-Report-${moment().format('jYYYY-jMM-jDD')}.xlsx`;
      
      // تنظیم هدرهای پاسخ برای دانلود فایل
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      
      return res.send(buffer);
    }

    // اگر خروجی JSON خواسته شده بود (رفتار پیش‌فرض)
    res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطا در تولید گزارش: ' + error.message });
    next(error);
  }
};

const getUserStats = async (req, res, next) => {
  try {
    const stats = await reportService.getUserMonthlyStats(req.params.userId, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

const getDepartmentTrend = async (req, res, next) => {
  try {
    const trend = await reportService.getDepartmentLateTrend(req.params.departmentId, req.query);
    res.status(200).json({ success: true, data: trend });
  } catch (error) {
    next(error);
  }
};

const getDepartmentsComparison = async (req, res, next) => {
  try {
    const comparison = await reportService.compareDepartmentPerformance(req.query);
    res.status(200).json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
};

const getPerformanceScorecard = async (req, res, next) => {
  try {
    const scorecard = await reportService.getAttendanceScorecard(req.query);
    res.status(200).json({ success: true, data: scorecard });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getComprehensiveReport,
  getUserStats,
  getDepartmentTrend,
  getDepartmentsComparison,
  getPerformanceScorecard,
};