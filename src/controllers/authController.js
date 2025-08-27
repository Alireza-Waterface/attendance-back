const authService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');

const register = catchAsync(async (req, res, next) => {
  const { user, tokens } = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'کاربر با موفقیت ایجاد شد.',
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        roles: user.roles,
      },
      tokens,
    },
  });
});

const login = catchAsync(async (req, res, next) => {
  try {
    const { user, tokens } = await authService.loginUser(req.body);

    const accessTokenOptions = {
      httpOnly: true, // غیرقابل دسترس برای جاوااسکریپت
      secure: process.env.NODE_ENV === 'production', // فقط در HTTPS
      sameSite: 'Strict',
      maxAge: 30 * 60 * 1000, // 30 دقیقه (به میلی‌ثانیه)
      path: '/',
    };

    const refreshTokenOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 روز
      path: '/',
    };

    res.cookie('accessToken', tokens.accessToken, accessTokenOptions);
    res.cookie('refreshToken', tokens.refreshToken, refreshTokenOptions);

    res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          roles: user.roles,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

const changePassword = catchAsync(async (req, res, next) => {
  await authService.changePassword(req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'رمز عبور با موفقیت تغییر کرد.',
  });
});

const logout = async (req, res, next) => {
  res.cookie('accessToken', '', { httpOnly: true, expires: new Date(0) });
  res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ success: true, message: 'خروج موفق' });
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const newAccessToken = await authService.refreshAccessToken(refreshToken);

    // تنظیمات کوکی برای accessToken جدید
    const accessTokenOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 1000, // 60 دقیقه
      path: '/',
    };
    res.cookie('accessToken', newAccessToken, accessTokenOptions);

    res.status(200).json({ success: true, message: 'Token refreshed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  changePassword,
  logout,
  refresh
};