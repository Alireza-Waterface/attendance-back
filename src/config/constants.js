const ROLES = {
  ADMIN: 'مدیر',
  OFFICER: 'مسئول',
  STAFF: 'کارمند',
  FACULTY: 'هیات_علمی',
  PROFESSOR: 'استاد'
};

const DEFAULT_DEPARTMENTS = [
  'آموزش',
  'فنی',
  'مالی',
  'حراست',
  'منابع انسانی',
  'پژوهش',
  'کتابخانه',
  'فناوری اطلاعات',
  'سایر'
];

const ATTENDANCE_STATUS = {
  PRESENT: 'حاضر',
  ABSENT: 'غایب',
  LATE: 'تاخیر',
  JUSTIFIED: 'موجه'
};

const PERFORMANCE_SCORE = {
  BASE_SCORE: 100,
  LATE_PENALTY: -2,
  ABSENT_PENALTY: -5,
};

module.exports = {
  ROLES,
  DEFAULT_DEPARTMENTS,
  ATTENDANCE_STATUS,
  PERFORMANCE_SCORE
};