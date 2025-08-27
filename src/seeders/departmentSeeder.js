// src/seeders/departmentSeeder.js
const mongoose = require('mongoose');
require('dotenv').config({ path: '../../.env' }); // مسیر فایل .env را مشخص می‌کنیم

const Department = require('../models/Department');
const { DEFAULT_DEPARTMENTS } = require('../config/constants');
const connectDB = require('../config/database');

// اتصال به دیتابیس
connectDB();

const importData = async () => {
  try {
    // ۱. حذف تمام داده‌های قبلی برای جلوگیری از تکرار
    await Department.deleteMany();

    // ۲. تبدیل آرایه نام‌ها به آرایه آبجکت‌ها برای Mongoose
    const departmentsToInsert = DEFAULT_DEPARTMENTS.map(name => ({ name }));

    // ۳. درج داده‌های جدید
    await Department.insertMany(departmentsToInsert);

    console.log('✅ داده‌های واحدها با موفقیت به دیتابیس اضافه شد.');
    process.exit();
  } catch (error) {
    console.error(`❌ خطا در ورود داده‌ها: ${error}`);
    process.exit(1);
  }
};

// دستور node src/seeders/departmentSeeder.js را برای اجرا وارد کنید
importData();