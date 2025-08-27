const Settings = require("../models/Settings");

// This object will act as a simple in-memory cache for our settings.
const appSettings = {};

const loadSettings = async () => {
	try {
		const settingsFromDB = await Settings.getSettings();

		// Set default values if they don't exist in the DB
		appSettings.workStartTime = settingsFromDB.workStartTime || "08:00";
		appSettings.workEndTime = settingsFromDB.workEndTime || "14:00";
		appSettings.lateThresholdTime =
			settingsFromDB.lateThresholdTime || "08:30";
		appSettings.workingDays = settingsFromDB.workingDays || [
			"Saturday",
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
		];
		appSettings.officerEditTimeLimit = settingsFromDB.officerEditTimeLimit || 30;

		console.log("✅ Application settings loaded successfully.");
	} catch (error) {
		console.error("❌ Failed to load application settings:", error);
		// Exit if settings can't be loaded, as the app might not function correctly
		process.exit(1);
	}
};

// Middleware to attach settings to each request
const attachSettings = (req, res, next) => {
	req.settings = appSettings;
	next();
};

// A function to reload settings after an admin updates them
const reloadSettings = async () => {
	console.log("🔄 Reloading application settings...");
	await loadSettings();
};

module.exports = {
	loadSettings,
	attachSettings,
	reloadSettings,
	appSettings, // Export for direct use in services
};