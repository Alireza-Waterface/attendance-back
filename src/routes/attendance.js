// src/routes/attendance.js
const express = require('express');
const router = express.Router();
const { recordAttendance, getMyAttendance, updateAttendance, getRecordsByRecorder, deleteAttendance } = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { ROLES } = require('../config/constants');
const validate = require('../middleware/validation');
const {
  recordAttendanceSchema,
  updateAttendanceSchema,
  idParamSchema,
  reportQuerySchema, // برای my-records که query params دارد
} = require('../utils/validators');

// @desc    Record check-in or check-out for a user
// @route   POST /api/attendance
// @access  Private (Officer only)
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), validate(recordAttendanceSchema), recordAttendance);

// @desc    Get my own attendance records (paginated)
// @route   GET /api/attendance/my-records
// @access  Private (Any logged-in user)
router.get('/my-records', protect, validate(reportQuerySchema), getMyAttendance);

// @desc    Update an attendance record
// @route   PUT /api/attendance/:id
// @access  Private (Admin or Officer)
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), validate(idParamSchema), validate(updateAttendanceSchema), updateAttendance);

router.get('/my-creations', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), validate(reportQuerySchema), getRecordsByRecorder);

router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), validate(idParamSchema), deleteAttendance);

module.exports = router;