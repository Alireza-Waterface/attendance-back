// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); 
const { register, login, changePassword, logout, refresh } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');

const validate = require('../middleware/validation');
const { registerSchema, loginSchema, changePasswordSchema } = require('../utils/validators');

// @desc    Register a new user (first admin)
// @route   POST /api/auth/register
// @access  Public
router.post('/register', validate(registerSchema), register);

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
// router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/login', validate(loginSchema), login);

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);

// @desc   Logout user
// @route  POST /api/auth/logout
// @access Public
router.post('/logout', logout);

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (but requires a valid refreshToken cookie)
router.post('/refresh', refresh);

module.exports = router;