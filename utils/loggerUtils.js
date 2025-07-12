const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const { combine, timestamp, errors, splat, printf, json, colorize } = winston.format;

const devFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  colorize(),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const m = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${stack || ''} ${m}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

const rotate = (filename, level) =>
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, filename + '-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level
  });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    consoleTransport,
    rotate('app', 'info'),
    rotate('error', 'error'),
    rotate('validation-errors', 'warn'),
    rotate('database-errors', 'warn'),
    rotate('security', 'warn')
  ],
  exitOnError: false
});

logger.stream = { write: msg => logger.info(msg.trim()) };

module.exports = {
  logger,
  logValidationError: (msg, meta) => logger.warn(msg, { ...meta, logType: 'validation' }),
  logDatabaseError: (msg, err, meta) =>
    logger.warn(msg, { ...meta, error: err.message, stack: err.stack, logType: 'database' }),
  logSecurityEvent: (msg, meta) => logger.warn(msg, { ...meta, logType: 'security' })
};
