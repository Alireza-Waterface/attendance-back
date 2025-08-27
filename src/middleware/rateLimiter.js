// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقیقه
  max: 200,
  message: {
    success: false,
    message: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 دقیقه
  max: 10,
  message: {
    success: false,
    message: 'تعداد تلاش‌ها برای ورود بیش از حد مجاز است. لطفاً ۳۰ دقیقه دیگر تلاش کنید.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  loginLimiter,
};