const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const logger = require("../config/logger");

// Helper function to run a Python script (can be a simplified version of mlService's)
const runScript = (scriptName) => {
	return new Promise((resolve, reject) => {
		logger.info(`Scheduler: Starting execution of ${scriptName}...`);

		const isWindows = os.platform() === "win32";
		const pythonExecutable = isWindows ? "python.exe" : "python";
		const venvPath = path.resolve(
			__dirname,
			"../../mlScripts/venv",
			isWindows ? "Scripts" : "bin",
			pythonExecutable
		);
		const scriptPath = path.resolve(
			__dirname,
			`../../mlScripts/${scriptName}`
		);

		const pythonProcess = spawn(venvPath, [scriptPath]);

		let output = "";
		pythonProcess.stdout.on("data", (data) => {
			output += data.toString("utf8");
		});
		pythonProcess.stderr.on("data", (data) => {
			output += data.toString("utf8");
		});

		pythonProcess.on("close", (code) => {
			if (code !== 0) {
				logger.error(
					`Scheduler: Script ${scriptName} failed with code ${code}. Output: ${output}`
				);
				return reject(new Error(`Script ${scriptName} failed.`));
			}
			logger.info(
				`Scheduler: Script ${scriptName} finished successfully. Output: ${output}`
			);
			resolve(output);
		});
	});
};

// The main function that schedules all jobs
const scheduleJobs = () => {
	// Schedule the model training to run once every day at 1 AM.
	// Cron format: (minute hour day-of-month month day-of-week)
	// '0 1 * * *' means at minute 0 of hour 1, every day.
	cron.schedule(
		"0 1 * * *",
		async () => {
			logger.info("--- Running Daily ML Model Training Job ---");
			try {
				await runScript("train_clustering_model.py");
				await runScript("train_anomaly_model.py");
				logger.info(
					"--- Daily ML Model Training Job Completed Successfully ---"
				);
			} catch (error) {
				logger.error("--- Daily ML Model Training Job Failed ---", {
					error,
				});
			}
		},
		{
			timezone: "Asia/Tehran", // Set the timezone for the schedule
		}
	);

	logger.info("✅ Cron jobs scheduled successfully.");
};

module.exports = {
	scheduleJobs,
};
