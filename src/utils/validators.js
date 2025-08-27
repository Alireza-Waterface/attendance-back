// src/utils/validators.js
const Joi = require("joi");
const { ROLES, ATTENDANCE_STATUS } = require("../config/constants");

// اسکیما برای ثبت‌نام اولیه مدیر
const registerSchema = Joi.object({
	fullName: Joi.string().min(3).max(50).required().messages({
		"string.base": "نام کامل باید یک رشته باشد",
		"string.empty": "نام کامل نمی‌تواند خالی باشد",
		"string.min": "نام کامل باید حداقل ۳ کاراکتر باشد",
		"any.required": "فیلد نام کامل الزامی است",
	}),
	personnelCode: Joi.string().required().messages({
		"string.empty": "کد پرسنلی نمی‌تواند خالی باشد",
		"any.required": "فیلد کد پرسنلی الزامی است",
	}),
	password: Joi.string().min(8).required().messages({
		"string.min": "رمز عبور باید حداقل ۸ کاراکتر باشد",
		"any.required": "فیلد رمز عبور الزامی است",
	}),
});

// اسکیما برای ورود
const loginSchema = Joi.object({
	// نام فیلد را به 'username' تغییر می‌دهیم
	username: Joi.string().required().messages({
		"string.empty": "کد پرسنلی یا کد ملی نمی‌تواند خالی باشد",
		"any.required": "فیلد کد پرسنلی/ملی الزامی است",
	}),
	password: Joi.string().required().messages({
		"string.empty": "رمز عبور نمی‌تواند خالی باشد",
		"any.required": "فیلد رمز عبور الزامی است",
	}),
});

// اسکیما برای تغییر رمز عبور
const changePasswordSchema = Joi.object({
	oldPassword: Joi.string().required().messages({
		"any.required": "رمز عبور فعلی الزامی است",
		"string.empty": "رمز عبور فعلی نمی‌تواند خالی باشد",
	}),
	newPassword: Joi.string().min(8).required().messages({
		"string.min": "رمز عبور جدید باید حداقل ۸ کاراکتر باشد",
		"any.required": "رمز عبور جدید الزامی است",
		"string.empty": "رمز عبور جدید نمی‌تواند خالی باشد",
	}),
});

// اسکیما برای ایجاد کاربر جدید توسط مدیر
const createUserSchema = Joi.object({
	fullName: Joi.string().min(2).max(50).required().messages({
		"string.empty": "نام کامل الزامی است",
		"any.required": "نام کامل الزامی است",
	}),
	password: Joi.string().min(8).required().messages({
		"string.min": "رمز عبور باید حداقل ۸ کاراکتر باشد",
		"any.required": "رمز عبور الزامی است",
	}),
	roles: Joi.array()
		.items(Joi.string().valid(...Object.values(ROLES)))
		.min(1)
		.required()
		.messages({
			"array.min": "حداقل یک نقش برای کاربر باید تعیین شود",
			"any.required": "نقش کاربر الزامی است",
		}),
	personnelCode: Joi.when("roles", {
		is: Joi.array()
			.items(Joi.string().valid(ROLES.ADMIN, ROLES.OFFICER, ROLES.STAFF))
			.min(1),
		then: Joi.string().required().messages({
			"any.required": "برای این نقش، کد پرسنلی الزامی است"
		}),
		otherwise: Joi.string().allow("").optional(),
	}),
	nationalCode: Joi.when("roles", {
		is: Joi.array()
			.items(Joi.string().valid(ROLES.PROFESSOR, ROLES.FACULTY))
			.min(1),
		then: Joi.string()
			.length(10)
			.pattern(/^[0-9]+$/)
			.required()
			.messages({
				"any.required": "برای این نقش، کد ملی الزامی است",
				"string.length": "کد ملی باید ۱۰ رقم باشد",
				"string.pattern.base": "کد ملی باید فقط شامل ارقام باشد",
			}),
		otherwise: Joi.string().allow("").optional(),
	}),
	isActive: Joi.boolean().optional(),
	phoneNumber: Joi.string().optional().allow(""),
	roomLocation: Joi.string().optional().allow(""), // اختیاری و می‌تواند خالی باشد
	departments: Joi.array().items(Joi.string()).optional(),
});

// اسکیما برای ویرایش کاربر توسط مدیر
const updateUserSchema = Joi.object({
	fullName: Joi.string().min(2).max(50),
	roles: Joi.array()
		.items(Joi.string().valid(...Object.values(ROLES)))
		.min(1),
	roomLocation: Joi.string().allow(""),
	isActive: Joi.boolean(),
	// توجه: ما به مدیر اجازه تغییر کد پرسنلی/ملی یا رمز عبور را از این مسیر نمی‌دهیم
	// برای این کار باید مسیرهای جداگانه‌ای در نظر گرفت.
});

// اسکیما برای پارامترهای URL (برای اطمینان از فرمت صحیح ID)
const idParamSchema = Joi.object({
	id: Joi.string().hex().length(24).required().messages({
		"string.length": "شناسه نامعتبر است",
		"string.hex": "شناسه نامعتبر است",
		"any.required": "شناسه الزامی است",
	}),
});

const updateUserCombinedSchema = updateUserSchema.concat(idParamSchema);

// اسکیما برای ثبت ورود/خروج
const recordAttendanceSchema = Joi.object({
	userId: Joi.string().hex().length(24).required().messages({
		"string.hex": "شناسه کاربر نامعتبر است",
		"any.required": "شناسه کاربر الزامی است",
	}),
	type: Joi.string().valid("check-in", "check-out").required().messages({
		"any.only": "نوع عملیات باید check-in یا check-out باشد",
		"any.required": "نوع عملیات الزامی است",
	}),
	timestamp: Joi.date().iso().optional(),
});

// اسکیما برای ویرایش رکورد حضور و غیاب
const updateAttendanceSchema = Joi.object({
	// پارامتر ID از URL می‌آید و جداگانه اعتبارسنجی می‌شود
	checkIn: Joi.date().iso(), // فرمت ISO 8601: "2023-10-27T08:30:00.000Z"
	checkOut: Joi.date().iso().allow(null),
	status: Joi.string().valid(...Object.values(ATTENDANCE_STATUS)),
	isJustified: Joi.boolean(),
	justificationNotes: Joi.string().allow("").max(200),
});

// اسکیما برای Query Params در گزارش‌گیری
const reportQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(10),
	userId: Joi.string().hex().length(24).optional(),
	// departmentId: Joi.string().hex().length(24).optional(),
	status: Joi.string()
		.valid(...Object.values(ATTENDANCE_STATUS))
		.optional(),
	startDate: Joi.string()
		.pattern(/^\d{4}\/\d{2}\/\d{2}$/)
		.optional(),
	endDate: Joi.string()
		.pattern(/^\d{4}\/\d{2}\/\d{2}$/)
		.optional(),
	export: Joi.string().valid("true").optional(),
})
	.with("startDate", "endDate") // اگر startDate بود، endDate هم باید باشد
	.with("endDate", "startDate"); // اگر endDate بود، startDate هم باید باشد

// اسکیما برای ایجاد واحد
const createDepartmentSchema = Joi.object({
	name: Joi.string().min(3).max(100).required().messages({
		"any.required": "نام واحد الزامی است",
	}),
	description: Joi.string().allow("").optional(),
});

// اسکیما برای ویرایش واحد
const updateDepartmentSchema = Joi.object({
	name: Joi.string().min(2).max(100),
	description: Joi.string().allow(""),
});

module.exports = {
	registerSchema,
	loginSchema,
	changePasswordSchema,
	createUserSchema,
	updateUserSchema,
	idParamSchema,
	updateUserCombinedSchema,
	recordAttendanceSchema,
	updateAttendanceSchema,
	reportQuerySchema,
	createDepartmentSchema,
	updateDepartmentSchema,
};
