const mongoose = require("mongoose");

// This schema is simple: a unique key and a value that can be anything.
const settingSchema = new mongoose.Schema({
	key: {
		type: String,
		required: true,
		unique: true,
		index: true,
	},
	value: {
		type: mongoose.Schema.Types.Mixed, // Can store strings, numbers, objects, etc.
		required: true,
	},
});

// This function will be a helper to load all settings into a single object.
settingSchema.statics.getSettings = async function () {
	const settingsDocs = await this.find();
	const settings = settingsDocs.reduce((acc, setting) => {
		acc[setting.key] = setting.value;
		return acc;
	}, {});
	return settings;
};

const Setting = mongoose.model("Settings", settingSchema);
module.exports = Setting;
