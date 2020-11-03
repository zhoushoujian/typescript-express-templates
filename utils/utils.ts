import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto'
import CONF from '../config'
import logger from './logger'

const _algorithm = 'aes-256-cbc';
const _iv = '66666666666666666666666666666666';
const ivBuffer = Buffer.from(_iv, 'hex');

const utils = {
  getIp: (req: any, str: string) => {
    // const userInfo = { ...req.query, ...req.body };
    let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
    if (ip.split(',').length > 0) {
      ip = ip.split(',')[0];
    }
    logger.info(` ${str}的访问者ip: `, ip);
    return ip;
  },

  jwtVerify: (token: string | undefined, res: any, cb: (a) => void) => {
    jwt.verify(token, CONF.TOKEN_ENCRYPT_KEY, (err, decoded) => {
      if (err) {
        logger.error("jwt.verify  err", err.stack || err.toString());
        //解析token是否过期 和是否是正确的token,若时间长无操作而过期则给出提示
        if (err.name === "TokenExpiredError" || err.message === "jwt expired" || err.message === "jwt malformed" || !token) {
          const wrapper = JSON.stringify({
            status: 'FAILURE',
            result: {
              errCode: 401,
              errText: 'token_expired'
            }
          });
          let tmpBuf: any = Buffer.from(wrapper);
          const headers = {
            'content-length': tmpBuf.length,
            'content-type': 'application/json'
          };
          res.writeHead(401, headers);
          res.write(tmpBuf);
          res.end();
          tmpBuf = null;
          return;
        } else {
          const wrapper = JSON.stringify({
            status: 'FAILURE',
            result: {
              errCode: 500,
              errText: err.stack || err.toString()
            }
          });
          let tmpBuf: any = Buffer.from(wrapper);
          const headers = {
            'content-length': tmpBuf.length,
            'content-type': 'application/json'
          };
          res.writeHead(401, headers);
          res.write(tmpBuf);
          res.end();
          tmpBuf = null;
          return;
        }
      } else {
        if (cb) {
          cb(decoded);
        }
      }
    });
  },

  writeResponse: (res: any, data: any) => {
    if (res) {
      try {
        if (Object.prototype.toString.call(data) !== "[object Object]") {
          logger.error("response data can't be a string", data);
          res.status(500).end();
        }
        const wrapper = JSON.stringify({
          status: 'SUCCESS',
          result: data
        });
        let tmpBuf: any = Buffer.from(wrapper);
        const headers = {};
        headers['content-length'] = tmpBuf.length;
        headers['content-type'] = 'application/json';
        res.writeHead(200, headers);
        res.write(tmpBuf);
        res.end();
        tmpBuf = null;
      } catch (e) {
        // Don't leave the client handing
        logger.error("writeResponse e", e.stack || e.toString());
        res.status(500).end(e.stack || e.toString());
      }
    }
  },

  reportError: (req, res, err) => {
    try {
      logger.error("reportError url", req.originalUrl, 'err', err);
      if (err) {
        if (Object.prototype.toString.call(err) === '[object Object]') {
          err = JSON.stringify(err);
        } else {
          err = err.stack || err.toString();
        }
      } else {
        err = "net error";
      }
      const wrapper = JSON.stringify({
        status: 'FAILURE',
        result: {
          errCode: 500,
          err
        }
      });
      let tmpBuf: any = Buffer.from(wrapper);
      const headers = {
        'content-length': tmpBuf.length,
        'content-type': 'application/json'
      };
      res.writeHead(500, headers);
      res.write(tmpBuf);
      res.end();
      tmpBuf = null;
    } catch (e) {
      // Don't leave client hanging
      res.status(500).end();
      logger.error("reportError e", e.stack || e.toString());
    }
  },

  reportInvokeError: (req, res, errText: string) => {
    try {
      logger.error("reportInvokeError url", req.originalUrl, 'errText', errText);
      const wrapper = JSON.stringify({
        status: 'FAILURE',
        result: {
          errCode: 400,
          errText
        }
      });
      let tmpBuf: any = Buffer.from(wrapper);
      const headers = {
        'content-length': tmpBuf.length,
        'content-type': 'application/json'
      };
      res.writeHead(400, headers);
      res.write(tmpBuf);
      res.end();
      tmpBuf = null;
    } catch (e) {
      res.status(500).end();
      logger.error("reportInvokeError e", e.stack || e.toString());
    }
  },

  encryptAES: (data: Buffer | string, key: Buffer | string) => {
    let keyBuf: any = null;
    if (key instanceof Buffer) {
      keyBuf = key;
    } else {
      keyBuf = Buffer.from(key, 'hex');
    }
    let dataBuf: any = null;
    if (data instanceof Buffer) {
      dataBuf = data;
    } else {
      dataBuf = Buffer.from(data, 'utf8');
    }
    const cipher = crypto.createCipheriv(_algorithm, keyBuf, ivBuffer);
    cipher.setAutoPadding(true);
    let cipherData = cipher.update(dataBuf, undefined, 'base64');
    cipherData += cipher.final('base64');

    return cipherData;
  },

  decryptAES: (data: Buffer | string, key: Buffer | string) => {
    let keyBuf: any = null;
    if (key instanceof Buffer) {
      keyBuf = key;
    } else {
      keyBuf = Buffer.from(key, 'hex');
    }
    let dataBuf: any = null;
    if (data instanceof Buffer) {
      dataBuf = data;
    } else {
      dataBuf = Buffer.from(data, 'base64');
    }
    const decipher = crypto.createDecipheriv(_algorithm, keyBuf, ivBuffer);
    decipher.setAutoPadding(true);
    let decipherData = decipher.update(dataBuf, 'binary', 'binary');
    decipherData += decipher.final('binary');
    const str = Buffer.from(decipherData, 'binary');
    return str.toString('utf8');
  },

  generateString: (num: number) => {
    let str = "", randomStr;
    // eslint-disable-next-line comma-spacing
    const template = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    for (let i = 0; i < num; i++) {
      randomStr = template[Math.floor(Math.random() * 36)];
      if (/[a-z]/g.test(randomStr)) {
        if (Math.random() * 2 < 1) {
          randomStr = randomStr.toUpperCase();
        }
      }
      str += randomStr;
    }
    logger.info("utils generateString str", str);
    return str;
  },

  refreshToken: (uuid: string) => {
    const token = jwt.sign({
      // eslint-disable-next-line camelcase
      user_id: 1, // user_id
      uuid // user_name
    }, CONF.TOKEN_ENCRYPT_KEY, { // 秘钥
      expiresIn: CONF.TOKEN_EXPIRED_TIME // 过期时间
    });
    return {
      access_token: token,
      expires_in: CONF.TOKEN_EXPIRED_TIME,
      expires_time: Date.now() + 1800 * 1000
    }
  },

  generateFourNumbers: () => {
    let verifyCode = String(Math.floor(Math.random() * 10000));
    if (verifyCode.length !== 4) {
      verifyCode = utils.generateFourNumbers();
    }
    return verifyCode;
  },

  checkEmail: (email: string) => {
    if (/^[0-9a-zA-Z_.-]+[@][0-9a-zA-Z_.-]+([.][a-zA-Z]+){1,2}$/g.test(email)) {
      return true;
    } else {
      return false;
    }
  },

  dealWithLoginData: (record) => {
    const username = record.username;
    const token = utils.refreshToken(record.uuid);
    const data = {
      token,
      username,
    };
    return data
  },

  format: (fmt: string) => {
    const self = new Date()
    const o = {
      "M+": self.getMonth() + 1, //月份
      "d+": self.getDate(), //日
      "h+": self.getHours(), //小时
      "m+": self.getMinutes(), //分
      "s+": self.getSeconds(), //秒
      "q+": Math.floor((self.getMonth() + 3) / 3), //季度
      S: self.getMilliseconds(), //毫秒
    };
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (self.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (const k in o) {
      if (new RegExp("(" + k + ")").test(fmt)) {
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length === 1
            ? o[k]
            : ("00" + o[k]).substr(("" + o[k]).length)
        );
      }
    }
    return fmt;
  }


};

export default utils;