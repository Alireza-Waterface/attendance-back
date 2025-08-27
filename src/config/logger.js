const winston = require('winston');
require('winston-daily-rotate-file');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};
winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }), // رنگی کردن خروجی کنسول
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const transports = [
  new winston.transports.Console(), // Show all logs in console (Development)
  
  // Save important errors to a separeate file
  new winston.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    level: 'error',
    format: winston.format.uncolorize(),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '30d',
  }),

  // All logs in a single file
  new winston.transports.DailyRotateFile({
    filename: 'logs/all-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format: winston.format.uncolorize(),
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '30d',
  }),
];

// ساخت Logger اصلی
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'http',
  levels,
  format,
  transports,
});

module.exports = logger;