const settingService = require("../services/settingsService");
const fs = require("fs");
const path = require("path");
const { reloadSettings } = require("../middleware/settingsLoader");

const getSettings = async (req, res, next) => {
	try {
		const settings = await settingService.getSettings();
		res.status(200).json({ success: true, data: settings });
	} catch (error) {
		next(error);
	}
};

const getPublicSettings = async (req, res, next) => {
	try {
		const publicSettings = await settingService.getPublicSettings();
		res.status(200).json({ success: true, data: publicSettings });
	} catch (error) {
		next(error);
	}
};

const updateSettings = async (req, res, next) => {
	try {
		const updatedSettings = await settingService.updateSettings(req.body);
		await reloadSettings();
		res.status(200).json({ success: true, data: updatedSettings });
	} catch (error) {
		next(error);
	}
};

const uploadLogo = async (req, res, next) => {
	try {
		if (!req.file) {
			throw new AppError("فایلی برای آپلود انتخاب نشده است.", 400);
		}

		// Get current settings to find and delete the old logo
		const currentSettings = await settingService.getSettings();
		const oldLogoPath = currentSettings.logoPath;

		// Delete the old logo if it exists and is not the default
		if (oldLogoPath && oldLogoPath !== "uploads/logos/default-logo.png") {
			const fullOldPath = path.join(__dirname, "..", "..", oldLogoPath);
			fs.promises
				.unlink(fullOldPath)
				.catch((err) => console.error("Old logo not found:", err));
		}

		const formattedPath = req.file.path.replace(/\\/g, "/");
		const updatedSettings = await settingService.updateSettings({
			logoPath: formattedPath,
		});

		res.status(200).json({ success: true, data: updatedSettings });
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getSettings,
	updateSettings,
	uploadLogo,
   getPublicSettings
};
