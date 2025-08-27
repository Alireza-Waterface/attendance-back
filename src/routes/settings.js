const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const {
	getSettings,
	updateSettings,
	uploadLogo,
   getPublicSettings
} = require("../controllers/settingsController");
const { logoUploader } = require("../middleware/upload"); // We'll need to adapt this!

router.get('/public', getPublicSettings);

// All routes in this file are for Admins only
router.use(protect, authorize("مدیر"));

router.route("/").get(getSettings).put(updateSettings); // For text-based settings

// A dedicated route for uploading the logo
router.put("/logo", logoUploader.single("logo"), uploadLogo);

module.exports = router;