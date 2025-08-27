const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');
const validate = require('../middleware/validation');
const {
  createDepartmentSchema,
  updateDepartmentSchema,
  idParamSchema,
} = require('../utils/validators');
const { ROLES } = require('../config/constants');

router.route('/')
  .get(protect, authorize(ROLES.ADMIN, ROLES.OFFICER), getAllDepartments)
  .post(protect, authorize(ROLES.ADMIN), validate(createDepartmentSchema), createDepartment)

router.route('/:id')
  .get(protect, authorize(ROLES.ADMIN), validate(idParamSchema), getDepartmentById)
  .put(protect, authorize(ROLES.ADMIN), validate(idParamSchema), validate(updateDepartmentSchema), updateDepartment)
  .delete(protect, authorize(ROLES.ADMIN), validate(idParamSchema), deleteDepartment);

module.exports = router;