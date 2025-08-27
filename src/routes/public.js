// src/routes/public.js
const express = require('express');
const router = express.Router();
const { getPublicUsers } = require('../controllers/userController');

// This file contains ONLY public routes. No 'protect' middleware is used here.
router.get('/users', getPublicUsers);

// You could add other public routes here in the future
// router.get('/stats', getPublicStats);

module.exports = router;