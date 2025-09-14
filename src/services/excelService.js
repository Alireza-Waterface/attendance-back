// src/services/excelService.js
const ExcelJS = require('exceljs');
const moment = require('moment-jalaali');

const generateAttendanceExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'سامانه حضور و غیاب دانشگاه';
  workbook.created = new Date();
  
  // راست به چپ کردن شیت
  const worksheet = workbook.addWorksheet('گزارش حضور و غیاب', {
    views: [{ rightToLeft: true }]
  });

  // تعریف ستون‌ها و هدرها
  worksheet.columns = [
    { header: 'ردیف', key: 'rowNum', width: 5 },
    { header: 'نام و نام خانوادگی', key: 'fullName', width: 25 },
    { header: 'کد پرسنلی/ملی', key: 'code', width: 15 },
    { header: 'تاریخ', key: 'date', width: 15 },
    { header: 'ساعت ورود', key: 'checkIn', width: 15 },
    { header: 'ساعت خروج', key: 'checkOut', width: 15 },
    { header: 'موجه', key: 'isJustified', width: 10 },
    { header: 'توضیحات', key: 'justificationNotes', width: 50 },
    { header: 'ثبت‌کننده', key: 'recordedBy', width: 25 },
  ];

  // استایل‌دهی به هدر
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // افزودن داده‌ها به شیت
  data.forEach((record, index) => {
    worksheet.addRow({
      rowNum: index + 1,
      fullName: record.user.fullName,
      code: record.user.personnelCode || record.user.nationalCode,
      date: record.date,
      checkIn: record.checkIn ? moment(record.checkIn).format('HH:mm:ss') : '-',
      checkOut: record.checkOut ? moment(record.checkOut).format('HH:mm:ss') : '-',
      isJustified: record.isJustified ? 'بله' : 'خیر',
      justificationNotes: record.justificationNotes,
      recordedBy: `${record.recordedBy.fullName} - ${record.recordedBy.personnelCode || record.recordedBy.nationalCode}`,
    });
  });

  // استایل‌دهی به تمام سلول‌ها
  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // تولید فایل در حافظه و برگرداندن بافر
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  generateAttendanceExcel,
};