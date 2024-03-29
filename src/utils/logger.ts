import * as fs from 'fs';
import * as path from 'path';
import * as Logger from 'beauty-logger';

function checkFileExist(filePath: string) {
  if (!fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, '');
  }
}

if (!fs.existsSync(path.join(__dirname, '../../logs'))) {
  fs.mkdirSync(path.join(__dirname, '../../logs'));
}
checkFileExist(path.join(__dirname, '../../logs/main.log'));
checkFileExist(path.join(__dirname, '../../logs/INFO.log'));
checkFileExist(path.join(__dirname, '../../logs/WARN.log'));
checkFileExist(path.join(__dirname, '../../logs/ERROR.log'));

const logger1 = new (Logger as any)({
  logFileSize: 1024 * 1024 * 100,
  logFilePath: path.join(__dirname, '../../logs/main.log'),
  dataTypeWarn: true,
  productionModel: false,
  enableMultipleLogFile: false,
  enableParallelPrint: true,
  folder: 'logs',
});

const logger2 = new (Logger as any)({
  logFileSize: 1024 * 1024 * 50,
  logFilePath: {
    info: path.join(__dirname, '../../logs/INFO.log'),
    warn: path.join(__dirname, '../../logs/WARN.log'),
    error: path.join(__dirname, '../../logs/ERROR.log'),
  },
  dataTypeWarn: true,
  productionModel: true,
  enableMultipleLogFile: true,
});

const logger = {
  debug: (...args: any) => {
    logger1.debug(...args);
    logger2.debug(...args);
  },
  info: (...args: any) => {
    logger1.info(...args);
    logger2.info(...args);
  },
  warn: (...args: any) => {
    logger1.warn(...args);
    logger2.warn(...args);
  },
  error: (...args: any) => {
    logger1.error(...args);
    logger2.error(...args);
  },
};

export default logger;
