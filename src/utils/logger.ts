import * as path from 'path';
import * as Logger from '@szhou/beauty-logger';

const logger = new (Logger as any)({
  logFileSize: 1024 * 1024 * 50,
  logFilePath: {
    log: path.join(__dirname, '../../logs/LOG.log'),
    info: path.join(__dirname, '../../logs/INFO.log'),
    warn: path.join(__dirname, '../../logs/WARN.log'),
    error: path.join(__dirname, '../../logs/ERROR.log'),
  },
  dataTypeWarn: true,
  productionModel: false,
  enableMultipleLogFile: true,
});

export default logger;
