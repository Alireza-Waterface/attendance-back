const Department = require("../models/Department");
const User = require("../models/User");
const AppError = require("../utils/AppError");

// ایجاد یک واحد جدید
const createDepartment = async (departmentData) => {
	const { name } = departmentData;
	// بررسی تکراری بودن نام واحد
	const existingDepartment = await Department.findOne({ name });
	if (existingDepartment) {
		throw new AppError("واحدی با این نام قبلاً ثبت شده است.", 409);
	}
	return await Department.create(departmentData);
};

// دریافت لیست تمام واحدها
const getAllDepartments = async () => {
	return await Department.find().sort({ name: 1 });
};

// دریافت یک واحد با شناسه
const getDepartmentById = async (departmentId) => {
	const department = await Department.findById(departmentId);
	if (!department) {
		throw new AppError("واحد مورد نظر یافت نشد.", 404);
	}
	return department;
};

// به‌روزرسانی یک واحد
const updateDepartment = async (departmentId, updateData) => {
	// 1. Create a clean object for the update.
	const cleanUpdateData = {};
	if (updateData.name) {
		cleanUpdateData.name = updateData.name;
	}
	if (updateData.description !== undefined) {
		// Allow setting an empty description
		cleanUpdateData.description = updateData.description;
	}

	// 2. Check if there's anything to update.
	if (Object.keys(cleanUpdateData).length === 0) {
		throw new AppError("هیچ داده معتبری برای ویرایش ارسال نشده است.", 400);
	}

	// 3. (Important) Check if the new name is already in use by another department.
	if (cleanUpdateData.name) {
		const existingDepartment = await Department.findOne({
			name: cleanUpdateData.name,
			_id: { $ne: departmentId },
		});
		if (existingDepartment) {
			throw new AppError("واحدی با این نام قبلاً ثبت شده است.", 409);
		}
	}

	// 4. Perform the update using the explicit $set operator.
	const department = await Department.findByIdAndUpdate(
		departmentId,
		{ $set: cleanUpdateData }, // <<== THE FIX IS HERE
		{
			new: true, // Return the modified document
			runValidators: true,
		}
	);

	if (!department) {
		throw new AppError("واحد مورد نظر یافت نشد.", 404);
	}

	return department;
};

// حذف یک واحد
const deleteDepartment = async (departmentId) => {
	// بسیار مهم: قبل از حذف، بررسی می‌کنیم که آیا کاربری به این واحد تخصیص داده شده است یا نه
	const userCount = await User.countDocuments({ departments: departmentId });
	if (userCount > 0) {
		throw new AppError(
			`امکان حذف این واحد وجود ندارد. ${userCount} کاربر به این واحد اختصاص دارند.`,
			400
		);
	}
	const department = await Department.findByIdAndDelete(departmentId);
	if (!department) {
		throw new AppError("واحد مورد نظر یافت نشد.", 404);
	}
	return department;
};

module.exports = {
	createDepartment,
	getAllDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
};
