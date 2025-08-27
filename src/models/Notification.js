const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const notificationSchema = new mongoose.Schema({
  // کاربری که این اعلان را دریافت می‌کند
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // کاربری که باعث ایجاد این اعلان شده (اختیاری)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // نوع اعلان برای دسته‌بندی و نمایش آیکون در فرانت‌اند
  type: {
    type: String,
    enum: [
      'ATTENDANCE_JUSTIFIED', // غیبت/تاخیر موجه شد
      'ATTENDANCE_UPDATED',   // رکورد حضور و غیاب شما ویرایش شد
      'PASSWORD_CHANGED',     // رمز عبور شما تغییر کرد
      'ROLE_UPDATED',         // نقش‌های شما توسط مدیر ویرایش شد
      'PROFILE_UPDATED_BY_ADMIN', // پروفایل شما توسط مدیر ویرایش شد
    ],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  // لینکی که کاربر با کلیک روی آن به صفحه مربوطه هدایت می‌شود
  link: {
    type: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Index برای کوئری‌های سریع‌تر
notificationSchema.index({ recipient: 1, isRead: 1 });

notificationSchema.plugin(mongoosePaginate);
const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;