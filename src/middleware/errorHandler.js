// src/middleware/errorHandler.js
const AppError = require('../utils/AppError');
const logger = require('../config/logger');

const handleCastErrorDB = (err) => {
  const message = `مقدار نامعتبر ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  // استخراج مقدار تکراری از پیام خطا
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `مقدار تکراری: ${value}. لطفاً از مقدار دیگری استفاده کنید.`;
  return new AppError(message, 409); // 409 Conflict
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `داده ورودی نامعتبر. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('توکن نامعتبر است. لطفاً دوباره وارد شوید.', 401);
const handleJWTExpiredError = () => new AppError('توکن شما منقضی شده است. لطفاً دوباره وارد شوید.', 401);

const sendErrorDev = (err, res) => {
  // پاسخ کامل برای محیط توسعه
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // خطاهای عملیاتی و قابل پیش‌بینی: پیام را به کاربر نمایش بده
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  
  // خطاهای برنامه‌نویسی یا ناشناخته: جزئیات را به کاربر نده
  // ۱. لاگ کردن خطا (قبلاً در بخش اصلی انجام می‌شود)
  // ۲. ارسال یک پیام عمومی
  return res.status(500).json({
    status: 'error',
    message: 'خطایی در سرور رخ داده است. لطفاً بعداً تلاش کنید.',
  });
};


const errorHandler = (err, req, res, next) => {
  // لاگ کردن تمام خطاها
  logger.error(err.message, { stack: err.stack, request: { method: req.method, url: req.originalUrl, ip: req.ip } });

  let error = err;
  
  // تبدیل خطاهای خاص به AppError
  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
  
  // اطمینان از وجود مقادیر پیش‌فرض
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    // در محیط Production، ممکن است خطاهای Mongoose `isOperational=true` نداشته باشند
    // پس آنها را به AppError تبدیل می‌کنیم تا به درستی مدیریت شوند
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;