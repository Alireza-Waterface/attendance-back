const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { ROLES } = require('../config/constants');
const { getClusters, getAnomalies } = require('../controllers/mlController');

// @desc    Get employee clusters based on their attendance behavior
// @route   GET /api/ml/clustering
// @access  Private (Admin)
router.get('/clustering', protect, authorize(ROLES.ADMIN), getClusters);

// @desc    Detect anomalous attendance records for a specific day
// @route   GET /api/ml/anomalies
// @access  Private (Admin)
router.get('/anomalies', protect, authorize(ROLES.ADMIN), getAnomalies);

module.exports = router;