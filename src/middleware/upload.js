const multer = require("multer");
const path = require("path");
const AppError = require("../utils/AppError");
const fs = require("fs");

const createUploader = (destination) => {
	const storage = multer.diskStorage({
		destination: (req, file, cb) => {
			const uploadDir = `uploads/${destination}/`;
			fs.mkdirSync(uploadDir, { recursive: true });
			cb(null, uploadDir);
		},
		filename: (req, file, cb) => {
			const prefix =
				destination === "logos" ? "logo" : `user-${req.user.id}`;
			const uniqueSuffix = `${prefix}-${Date.now()}${path.extname(
				file.originalname
			)}`;
			cb(null, uniqueSuffix);
		},
	});

	const fileFilter = (req, file, cb) => {
		const allowedTypes = /jpeg|jpg|png|webp/;
		const mimetype = allowedTypes.test(file.mimetype);
		const extname = allowedTypes.test(
			path.extname(file.originalname).toLowerCase()
		);

		if (mimetype && extname) {
			return cb(null, true);
		}

		cb(
			new AppError(
				"خطا: فقط فایل‌های تصویری (jpeg, jpg, png, webp) مجاز هستند!",
				400
			),
			false
		);
	};

	return multer({
		storage: storage,
		fileFilter: fileFilter,
		limits: { fileSize: 1024 * 1024 * 5 },
	});
};

module.exports = {
	avatarUploader: createUploader("avatars"),
	logoUploader: createUploader("logos"),
};
