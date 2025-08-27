// src/services/mlService.js
const { spawn } = require("child_process");
const path = require("path");
const AppError = require("../utils/AppError");
const os = require("os");

const runPythonScript = (scriptName, args = []) => {
	return new Promise((resolve, reject) => {
		const scriptPath = path.resolve(
			__dirname,
			`../../mlScripts/${scriptName}`
		);
		// مسیر فعال‌ساز محیط مجازی پایتون
		const venvActivate = path.resolve(
			__dirname,
			"../../mlScripts/venv/Scripts/python"
		);

		const isWindows = os.platform() === "win32";
		const pythonExecutable = isWindows ? "python.exe" : "python";
		const venvPath = path.resolve(
			__dirname,
			"../../mlScripts/venv",
			isWindows ? "Scripts" : "bin",
			pythonExecutable
		);
		// --- >> END OF FIX << ---

		// Check if the python executable actually exists before trying to run it
		const fs = require("fs");
		if (!fs.existsSync(venvPath)) {
			return reject(
				new AppError(
					`Python executable not found at: ${venvPath}. Did you create the virtual environment?`,
					500
				)
			);
		}

		// اجرای اسکریپت با مفسر پایتون محیط مجازی
		const pythonProcess = spawn(venvActivate, [scriptPath, ...args]);

		let result = "";
		let error = "";

		pythonProcess.stdout.on("data", (data) => {
			result += data.toString('utf8');
		});

		pythonProcess.stderr.on("data", (data) => {
			error += data.toString('utf8');
		});

		pythonProcess.on("close", (code) => {
			if (code !== 0) {
				return reject(
					new AppError(`خطا در اجرای اسکریپت پایتون: ${error}`, 500)
				);
			}
			try {
				resolve(JSON.parse(result));
			} catch (e) {
				reject(
					new AppError("خطا در پارس کردن خروجی اسکریپت پایتون.", 500)
				);
			}
		});
	});
};

const getEmployeeClusters = async () => {
	return await runPythonScript("predict_clusters.py");
};

const getDailyAnomalies = async (date) => {
	if (!date) {
		throw new AppError(
			"تاریخ مورد نظر برای شناسایی ناهنجاری الزامی است.",
			400
		);
	}
	// ارسال تاریخ به عنوان آرگومان به اسکریپت پایتون
	return await runPythonScript("detect_anomalies.py", [date]);
};

module.exports = {
	getEmployeeClusters,
	getDailyAnomalies,
};
