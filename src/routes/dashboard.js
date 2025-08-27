const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { ROLES } = require('../config/constants');

// @desc    Get dashboard statistics for the current day
// @route   GET /api/dashboard
// @access  Private (Admin only)
router.get(
  '/',
  protect,
  authorize(ROLES.ADMIN),
  getDashboardStats
);

module.exports = router;