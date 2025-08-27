// src/middleware/validation.js
const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    // ما داده‌ها را از body, params, و query همزمان اعتبارسنجی می‌کنیم
    const dataToValidate = { ...req.body, ...req.params, ...req.query };

    const { error } = schema.validate(dataToValidate, {
      abortEarly: false, // تمام خطاها را نمایش بده، نه فقط اولین خطا
      allowUnknown: true, // فیلدهای ناشناس در درخواست را نادیده بگیر
    });

    if (error) {
      // استخراج پیام‌های خطا از Joi و فرمت‌دهی آن‌ها
      const errorMessages = error.details.map((detail) => detail.message).join(', ');
      
      return res.status(400).json({
        success: false,
        message: 'خطای اعتبارسنجی: ' + errorMessages,
      });
    }

    // اگر خطایی وجود نداشت، به کنترلر بعدی برو
    next();
  };
};

module.exports = validate;