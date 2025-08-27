const departmentService = require('../services/departmentService');

const createDepartment = async (req, res, next) => {
  try {
    const department = await departmentService.createDepartment(req.body);
    res.status(201).json({ success: true, message: 'واحد جدید با موفقیت ایجاد شد.', data: department });
  } catch (error) {
    next(error);
  }
};

const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await departmentService.getAllDepartments();
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
};

const getDepartmentById = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    res.status(200).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const department = await departmentService.updateDepartment(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'واحد با موفقیت به‌روزرسانی شد.', data: department });
  } catch (error) {
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    await departmentService.deleteDepartment(req.params.id);
    res.status(204).send(); // 204 No Content: بهترین پاسخ برای حذف موفق
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
};