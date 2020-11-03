import * as path from 'path'
import * as Logger from "beauty-logger"

const logger1 = new Logger({
  logFileSize: 1024 * 1024 * 10,
  logFilePath: path.join(__dirname, "../logs/shuyun.log"),
  dataTypeWarn: true,
  productionModel: false,
  enableMultipleLogFile: false,
  enableParallelPrint: true,
  folder: "logs",
});
const logger2 = new Logger({
  logFileSize: 1024 * 1024 * 5,
  logFilePath: {
    info: path.join(__dirname, "../logs/INFO.log"),
    warn: path.join(__dirname, "../logs/WARN.log"),
    error: path.join(__dirname, "../logs/ERROR.log"),
  },
  dataTypeWarn: true,
  productionModel: true,
  enableMultipleLogFile: true,
});

const logger = {
  debug: (...args) => {
    logger1.debug(...args);
    logger2.debug(...args);
  },
  info: (...args) => {
    logger1.info(...args);
    logger2.info(...args);
  },
  warn: (...args) => {
    logger1.warn(...args);
    logger2.warn(...args);
  },
  error: (...args) => {
    logger1.error(...args);
    logger2.error(...args);
  },
};

export default logger;
