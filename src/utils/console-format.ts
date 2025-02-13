import * as os from 'os';

const getTime = () => {
  const year = new Date().getFullYear();
  let month: string | number = new Date().getMonth() + 1;
  let day: string | number = new Date().getDate();
  let hour: string | number = new Date().getHours();
  let minute: string | number = new Date().getMinutes();
  let second: string | number = new Date().getSeconds();
  let mileSecond: string | number = new Date().getMilliseconds();
  if (month < 10) {
    month = '0' + month;
  }
  if (day < 10) {
    day = '0' + day;
  }
  if (hour < 10) {
    hour = '0' + hour;
  }
  if (minute < 10) {
    minute = '0' + minute;
  }
  if (second < 10) {
    second = '0' + second;
  }
  if (mileSecond < 10) {
    mileSecond = '00' + mileSecond;
  } else if (mileSecond < 100) {
    mileSecond = '0' + mileSecond;
  }
  const time = `${year}-${month}-${day} ${hour}:${minute}:${second}.${mileSecond}`;
  return time;
};

const colors = {
  Reset: '\x1b[0m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
};

const _console: Console = { ...console };

export const consoleFormat = () => {
  'debug:debug:FgBlue,info:info:FgGreen,warn:warn:FgYellow,error:error:FgRed,log:log:FgGreen'
    .split(',')
    .forEach(function (logColor) {
      const [log, info, color] = logColor.split(':');
      //@ts-ignore
      console[log] = function (...args: any[]) {
        const exactInfo = ` [${os.hostname()}] [${process.pid}]`;
        //@ts-ignore
        _console[log](
          `${(colors as any)[color]}[${getTime()}] [${info.toUpperCase()}]${exactInfo}${colors.Reset}`,
          ...args,
          colors.Reset,
        );
      };
    });
};
