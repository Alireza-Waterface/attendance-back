const Settings = require("../models/Settings");

const PUBLIC_SETTING_KEYS = ["universityName", "title", "logoPath"];

const getPublicSettings = async () => {
	const settingsDocs = await Settings.find({
		key: { $in: PUBLIC_SETTING_KEYS },
	});

	const settings = settingsDocs.reduce((acc, setting) => {
		acc[setting.key] = setting.value;
		return acc;
	}, {});

	return settings;
};

/**
 * Retrieves all settings from the database as a single object.
 */
const getSettings = async () => {
	return Settings.getSettings();
};

/**
 * Updates multiple settings at once.
 * @param {object} settingsToUpdate - An object where keys are setting keys and values are the new values.
 */
const updateSettings = async (settingsToUpdate) => {
	const promises = Object.entries(settingsToUpdate).map(([key, value]) => {
		return Settings.findOneAndUpdate(
			{ key },
			{ $set: { value } },
			{ upsert: true, new: true, runValidators: true } // upsert: if not found, create it.
		);
	});

	await Promise.all(promises);

	// Return the full, updated list of settings
	return Settings.getSettings();
};

module.exports = {
	getSettings,
	updateSettings,
   getPublicSettings
};
