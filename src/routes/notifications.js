const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAsRead, deleteNotification } = require('../controllers/notificationController');
const validate = require('../middleware/validation');
const { idParamSchema } = require('../utils/validators');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, getNotifications);

// @desc    Mark notifications as read
// @route   PATCH /api/notifications/read
// @access  Private
router.patch('/read', protect, markAsRead);

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private (Recipient or Admin)
router.delete('/:id', protect, validate(idParamSchema), deleteNotification);

module.exports = router;