const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const { apiLimiter } = require("./src/middleware/rateLimiter");
require("dotenv").config();
const path = require("path");

const connectDB = require("./src/config/database");
const errorHandler = require("./src/middleware/errorHandler");

const logger = require("./src/config/logger");

const cookieParser = require("cookie-parser");

const { loadSettings, attachSettings } = require('./src/middleware/settingsLoader');

// Import routes
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const attendanceRoutes = require("./src/routes/attendance");
const reportRoutes = require("./src/routes/reports");
const dashboardRoutes = require("./src/routes/dashboard");
const notificationRoutes = require("./src/routes/notifications");
const departmentRoutes = require("./src/routes/departments");
const mlRoutes = require("./src/routes/ml");
const publicRoutes = require("./src/routes/public");
const settingsRoutes = require("./src/routes/settings");

const app = express();

connectDB();

// Security middleware
app.use(
	helmet({
		crossOriginResourcePolicy: {
			policy: "cross-origin",
		},
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: ["'self'", "https://fonts.googleapis.com"],
				imgSrc: ["'self'", "data:", "http://localhost:5000"],
				connectSrc: ["'self'"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				objectSrc: ["'none'"],
				upgradeInsecureRequests: [],
			},
		},
	})
);

app.use(apiLimiter);

// CORS configuration
app.use(
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:8585",
		credentials: true,
	})
);

// Simple middleware for logging HTTP requests using Winston
app.use((req, res, next) => {
	logger.http(`Request: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
	next();
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize data to prevent NoSQL Injection
app.use(mongoSanitize());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		message: "Server running smoothly",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

app.use(cookieParser());

app.use(attachSettings);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/settings", settingsRoutes);

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({
		success: false,
		message: "Requested path not found",
		path: req.originalUrl,
	});
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
   await loadSettings();

   app.listen(PORT, () => {
      logger.info(`🚀 Server running on port: ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`📊 Health Check: http://localhost:${PORT}/health`);
   });
};

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
	logger.error(`Error: ${err.message}`);
	server.close(() => {
		process.exit(1);
	});
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	logger.error(`Unexpected Error: ${err.message}`);
	process.exit(1);
});

module.exports = app;
