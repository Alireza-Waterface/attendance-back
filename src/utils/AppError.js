// src/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // برای تشخیص خطاهای قابل پیش‌بینی از باگ‌های برنامه

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;