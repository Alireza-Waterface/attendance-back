// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../config/logger'); // <<== لاگر را ایمپورت کنید

const protect = async (req, res, next) => {
  // --- >> لاگ‌های دیباگ << ---
  logger.debug('--- Entering Protect Middleware ---');
  logger.debug(`Cookies from request: ${JSON.stringify(req.cookies)}`);
  // --- >> پایان لاگ‌های دیباG << ---

  let token;

  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
    logger.debug('Token found in cookies.');
  }

  if (!token) {
    logger.warn('No token found. Access denied.');
    return next(new AppError('شما احراز هویت نشده‌اید. لطفاً وارد شوید.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.debug(`Token decoded successfully for user ID: ${decoded.id}`);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      logger.warn(`User with ID ${decoded.id} not found in DB.`);
      return next(new AppError('کاربر مربوط به این توکن دیگر وجود ندارد.', 401));
    }
    
    req.user = user;
    logger.debug('User attached to request. Moving to next middleware.');
    next();
  } catch (error) {
    logger.error('Token verification failed.', { error: error.message });
    return next(new AppError('توکن نامعتبر یا منقضی شده است.', 401));
  }
};

module.exports = { protect };