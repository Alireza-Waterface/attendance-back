const attendanceService = require('../services/attendanceService');
const catchAsync = require('../utils/catchAsync');

const recordAttendance = catchAsync(async (req, res, next) => {
  const { userId, type, timestamp } = req.body;
  const recordedById = req.user.id;

  if (!userId || !type) {
    return res.status(400).json({ success: false, message: 'لطفاً ID کاربر و نوع عملیات را ارسال کنید.' });
  }

  const attendanceRecord = await attendanceService.recordAttendance({
    userId,
    type,
    recordedById,
    timestamp
  });

  res.status(201).json({
    success: true,
    message: `عملیات ${type === 'check-in' ? 'ورود' : 'خروج'} با موفقیت ثبت شد.`,
    data: attendanceRecord,
  });
});

const getMyAttendance = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const records = await attendanceService.getMyAttendanceRecords(userId, req.query);
  res.status(200).json({
    success: true,
    data: records,
  });
});

const updateAttendance = catchAsync(async (req, res, next) => {
  const recordId = req.params.id;
  const updateData = req.body;
  const currentUser = req.user;

  const updatedRecord = await attendanceService.updateAttendanceRecord(
    recordId,
    updateData,
    currentUser
  );

  res.status(200).json({
    success: true,
    message: 'رکورد با موفقیت به‌روزرسانی شد.',
    data: updatedRecord,
  });
});

const getRecordsByRecorder = catchAsync(async (req, res, next) => {
  const recorderId = req.user.id;
  const { sortBy, role } = req.query;

  try {
    const records = await attendanceService.getRecordsByRecorderToday({recorderId, sortBy, role});

    res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
});

const deleteAttendance = async (req, res, next) => {
  try {
    await attendanceService.deleteAttendanceRecord(req.params.id, req.user);
    res.status(204).json(null);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordAttendance,
  getMyAttendance,
  updateAttendance,
  getRecordsByRecorder,
  deleteAttendance
};