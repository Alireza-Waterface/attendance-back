// src/routes/reports.js
const express = require('express');
const router = express.Router();
const {
	getComprehensiveReport,
	getUserStats,
	getDepartmentTrend,
	getDepartmentsComparison,
  getPerformanceScorecard,
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { ROLES } = require('../config/constants');
const validate = require('../middleware/validation');
const { reportQuerySchema } = require('../utils/validators');

// @desc    Get a comprehensive and filterable attendance report
// @route   GET /api/reports
// @access  Private (Admin only)
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), validate(reportQuerySchema), getComprehensiveReport);

// @desc    Get monthly stats for a specific user
// @route   GET /api/reports/stats/user/:userId
// @access  Private (Admin)
router.get('/stats/user/:userId', protect, authorize(ROLES.ADMIN), getUserStats);

// @desc    Get late trend for a specific department
// @route   GET /api/reports/stats/department-trend/:departmentId
// @access  Private (Admin)
router.get('/stats/department-trend/:departmentId', protect, authorize(ROLES.ADMIN), getDepartmentTrend);

// @desc    Compare performance across all departments
// @route   GET /api/reports/stats/departments-comparison
// @access  Private (Admin)
router.get('/stats/departments-comparison', protect, authorize(ROLES.ADMIN), getDepartmentsComparison);

// @desc    Get attendance performance scorecard for users
// @route   GET /api/reports/performance-scorecard
// @access  Private (Admin)
router.get('/performance-scorecard', protect, authorize(ROLES.ADMIN), getPerformanceScorecard);

module.exports = router;