// src/middleware/roles.js
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // این میدلور فرض می‌کند که میدلور `protect` قبل از آن اجرا شده
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, message: 'خطای دسترسی: اطلاعات کاربر موجود نیست' });
    }

    const rolesArray = [...allowedRoles];

    // چک می‌کنیم آیا حداقل یکی از نقش‌های کاربر در لیست نقش‌های مجاز وجود دارد
    const result = req.user.roles.some(role => rolesArray.includes(role));

    if (!result) {
      return res.status(403).json({ success: false, message: 'شما دسترسی لازم برای انجام این عملیات را ندارید' });
    }

    next();
  };
};

module.exports = { authorize };