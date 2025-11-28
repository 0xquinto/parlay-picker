import fs from "fs";
import path from "path";
import { createLogger, format, transports } from "winston";
import { env, isProduction } from "../config/environment";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
  level: isProduction ? "info" : "debug",
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: "nfl-prediction-aggregator" },
  transports: [
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5_000_000,
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 10_000_000,
      maxFiles: 5,
    }),
  ],
});

if (!isProduction) {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.timestamp(), format.printf(({ level, message, timestamp, ...meta }) => {
        const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `[${timestamp}] ${level}: ${message}${metaString}`;
      })),
    }),
  );
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  withContext: (context: Record<string, unknown>) =>
    ({
      info: (message: string, meta?: Record<string, unknown>) => logger.info(message, { ...context, ...meta }),
      warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, { ...context, ...meta }),
      error: (message: string, meta?: Record<string, unknown>) => logger.error(message, { ...context, ...meta }),
      debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, { ...context, ...meta }),
    }),
};

export default logger;
