// src/routes/users.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { ROLES } = require("../config/constants");
const {
	getMyProfile,
	createUser,
	updateMyProfile,
	getAllUsers,
	getUserById,
	updateUser,
	uploadAvatar,
	deleteUser,
	getPublicUsers,
	searchUsers,
} = require("../controllers/userController");
const validate = require("../middleware/validation");
const {
	createUserSchema,
	updateUserSchema,
	idParamSchema,
	updateUserCombinedSchema,
} = require("../utils/validators");
const { avatarUploader } = require("../middleware/upload");

router
	.route("/profile")
	.get(protect, getMyProfile) // GET /api/users/profile
	.put(protect, updateMyProfile); // PUT /api/users/profile

// @desc    Search for users for selection lists
// @route   GET /api/users/search
// @access  Private (Admin & Officer)
router.get('/search', protect, authorize(ROLES.ADMIN, ROLES.OFFICER), searchUsers);

router
	.route("/")
	.get(protect, authorize(ROLES.ADMIN), getAllUsers)
	.post(
		protect,
		authorize(ROLES.ADMIN),
		validate(createUserSchema),
		createUser
	);

// GET /api/users/:id -> دریافت جزئیات یک کاربر
// PUT /api/users/:id -> ویرایش یک کاربر
router
	.route("/:id")
	.get(protect, authorize(ROLES.ADMIN), validate(idParamSchema), getUserById)
	.put(
		protect,
		authorize(ROLES.ADMIN),
		validate(updateUserCombinedSchema),
		updateUser
	)
	.delete(
		protect,
		authorize(ROLES.ADMIN),
		validate(idParamSchema),
		deleteUser
	);

router.get("/public", getPublicUsers);

// @desc    Upload profile picture for the logged-in user
// @route   PUT /api/users/profile/avatar
// @access  Private
router.put(
	"/profile/avatar",
	protect,
	avatarUploader.single("avatar"),
	uploadAvatar
);

module.exports = router;