const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { generateTokens } = require("../utils/jwt");
const { ROLES } = require("../config/constants");
const AppError = require("../utils/AppError");
const { createNotification } = require("./notificationService");
require("dotenv").config();

const registerUser = async (userData) => {
	const { fullName, personnelCode, password, roles } = userData;

	const userExists = await User.findOne({ personnelCode });
	if (userExists) {
		throw new AppError(
			"کاربری با این کد پرسنلی قبلا ثبت‌نام کرده است.",
			409
		);
	}

	const user = await User.create({
		fullName,
		personnelCode,
		password,
		roles,
	});

	if (!user) {
		throw new Error("خطا در ایجاد کاربر. لطفا دوباره تلاش کنید.");
	}

	const tokens = generateTokens(user);

	const decodedRefreshToken = jwt.decode(tokens.refreshToken);
	await RefreshToken.create({
		user: user._id,
		token: tokens.refreshToken,
		expiresAt: new Date(decodedRefreshToken.exp * 1000),
	});

	return { user, tokens };
};

const loginUser = async (loginData) => {
	const { username, password } = loginData;

	const user = await User.findOne({
		$or: [{ personnelCode: username }, { nationalCode: username }],
	}).select("+password");
	if (!user || !(await user.matchPassword(password))) {
		throw new AppError("کد پرسنلی/ملی یا رمز عبور نامعتبر است.", 401);
	}

	const tokens = generateTokens(user);

	const decodedRefreshToken = jwt.decode(tokens.refreshToken);
	await RefreshToken.findOneAndUpdate(
		{ user: user._id },
		{
			token: tokens.refreshToken,
			expiresAt: new Date(decodedRefreshToken.exp * 1000),
		},
		{ upsert: true, new: true }
	);

	return { user, tokens };
};

/**
 * Changes the password for a logged-in user.
 * @param {string} userId - The ID of the user changing their password.
 * @param {object} passwordData - Object containing oldPassword and newPassword.
 */
const changePassword = async (userId, passwordData) => {
	const { oldPassword, newPassword } = passwordData;

	// 1. Find the user but ALSO select the password field, which is normally hidden.
	const user = await User.findById(userId).select("+password");
	if (!user) {
		throw new AppError("کاربر یافت نشد. لطفاً دوباره وارد شوید.", 401);
	}

	// 2. Validate the old password.
	const isMatch = await user.matchPassword(oldPassword);
	if (!isMatch) {
		throw new AppError("رمز عبور فعلی نامعتبر است.", 400);
	}

	// 3. (Optional but recommended) Prevent setting the same password again.
	if (oldPassword === newPassword) {
		throw new AppError(
			"رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد.",
			400
		);
	}

	// 4. Set the new password. The .pre('save') hook in your User model will automatically hash it.
	user.password = newPassword;
	await user.save();

	// 5. Send a notification to the user about the security event.
	await createNotification({
		recipient: userId,
		type: "PASSWORD_CHANGED",
		message: "رمز عبور شما با موفقیت تغییر کرد.",
	});

	// No data needs to be returned on success.
};

const logoutUser = async (refreshToken) => {
	await RefreshToken.deleteOne({ token: refreshToken });
};

const refreshAccessToken = async (refreshToken) => {
	if (!refreshToken) throw new AppError("Refresh token not found", 401);

	const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
	if (!tokenDoc) throw new AppError("Invalid refresh token", 403);

	try {
		const decoded = jwt.verify(
			refreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);

		// ۳. پیدا کردن کاربر مربوطه
		const user = await User.findById(decoded.id);
		if (!user) {
			throw new AppError("User not found", 403);
		}

		// ۴. صدور یک accessToken جدید
		const newAccessToken = jwt.sign(
			{ id: user._id, roles: user.roles },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.JWT_EXPIRES_IN }
		);

		return newAccessToken;
	} catch (error) {
		// اگر رفرش توکن منقضی شده یا نامعتبر بود
		throw new AppError(
			"Refresh token expired or invalid. Please log in again.",
			403
		);
	}
};

module.exports = {
	registerUser,
	loginUser,
	changePassword,
	logoutUser,
	refreshAccessToken,
};
