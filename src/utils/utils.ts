import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as express from 'express';
import CONF from '@/config';
import { setCacheValue, expireCacheValue, delCacheValue } from '@/services/redis';
import { IRequest } from '@/@types/common';
import logger from './logger';

const _algorithm = 'aes-256-cbc';
const _iv = '66666666666666666666666666666666';
const ivBuffer = Buffer.from(_iv, 'hex');

const utils = {
  getIp: (req: any, str: string | null) => {
    // const userInfo = { ...req.query, ...req.body };
    let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
    if (ip.split(',').length > 0) {
      ip = ip.split(',')[0];
    }
    if (str) {
      logger.info(`${str}的访问者ip: `, ip);
    }
    return ip;
  },

  writeResponse: (req: IRequest, res: express.Response, data: any) => {
    try {
      if (Object.prototype.toString.call(data) !== '[object Object]') {
        logger.error("response data can't be a string", data);
        return utils.reportError(req, res, new Error('response必须是一个对象'));
      }
      const wrapper = JSON.stringify({
        status: 'SUCCESS',
        response: data,
        request: {
          ...req.query,
          ...req.body,
        },
        duration: Date.now() - req.now,
      });
      let tmpBuf: any = Buffer.from(wrapper);
      const headers = {} as any;
      headers['content-length'] = tmpBuf.length;
      headers['content-type'] = 'application/json';
      res.writeHead(200, headers);
      res.write(tmpBuf);
      res.end();
      tmpBuf = null;
      return undefined;
    } catch (e: any) {
      // Don't leave the client handing
      logger.error('writeResponse e', e.stack || e.toString());
      return utils.reportError(req, res, e);
    }
  },

  reportError: (req: IRequest, res: express.Response, err: Error | unknown) => {
    try {
      logger.error('reportError url', req.originalUrl, 'err', err);
      // err = "系统错误，请联系管理员";
      const wrapper = JSON.stringify({
        status: 'FAILURE',
        response: {
          errCode: 500,
          errText: (err as Error).stack || (err as Error).toString(),
          request: {
            ...req.query,
            ...req.body,
          },
          duration: Date.now() - req.now,
        },
      });
      let tmpBuf: any = Buffer.from(wrapper);
      const headers = {
        'content-length': tmpBuf.length,
        'content-type': 'application/json',
      };
      res.writeHead(500, headers);
      res.write(tmpBuf);
      res.end();
      tmpBuf = null;
    } catch (e: any) {
      // Don't leave client hanging
      res.status(500).end();
      logger.error('reportError e', e.stack || e.toString());
    }
  },

  reportInvokeError: (req: IRequest, res: express.Response, errText: string) => {
    try {
      logger.warn('reportInvokeError url', req.originalUrl, 'errText', errText);
      if (typeof errText !== 'string') {
        logger.warn('reportInvokeError errText is not string');
        return utils.reportError(req, res, new Error('errText is not string'));
      }
      const wrapper = JSON.stringify({
        status: 'FAILURE',
        response: {
          errCode: 400,
          errText,
        },
        request: {
          ...req.query,
          ...req.body,
        },
        duration: Date.now() - req.now,
      });
      let tmpBuf: any = Buffer.from(wrapper);
      const headers = {
        'content-length': tmpBuf.length,
        'content-type': 'application/json',
      };
      res.writeHead(400, headers);
      res.write(tmpBuf);
      res.end();
      tmpBuf = null;
      return undefined;
    } catch (e: any) {
      logger.error('reportInvokeError e', e.stack || e.toString());
      return res.status(500).end();
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
    let str = '',
      randomStr;
    // eslint-disable-next-line comma-spacing
    const template = [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
    ];
    for (let i = 0; i < num; i++) {
      randomStr = template[Math.floor(Math.random() * 36)];
      if (/[a-z]/g.test(String(randomStr))) {
        if (Math.random() * 2 < 1 && typeof randomStr === 'string') {
          randomStr = randomStr.toUpperCase();
        }
      }
      str += randomStr;
    }
    logger.info('utils generateString str', str);
    return str;
  },

  refreshToken: async (uuid: string, token: string) => {
    const accessToken = jwt.sign(
      {
        // eslint-disable-next-line camelcase
        user_id: 1, // user_id
        uuid, // user_name
      },
      CONF.TOKEN_ENCRYPT_KEY,
      {
        // 秘钥
        expiresIn: CONF.TOKEN_EXPIRED_TIME, // 过期时间
      },
    );
    const cacheKey = `${CONF.TOKEN_FOR_CACHE}: ${accessToken}`;
    await setCacheValue(cacheKey, 'exist');
    expireCacheValue(cacheKey, CONF.TOKEN_EXPIRED_TIME);
    if (token) {
      delCacheValue(`${CONF.TOKEN_FOR_CACHE}: ${token}`);
    }
    return {
      access_token: accessToken,
      expires_in: CONF.TOKEN_EXPIRED_TIME,
      expires_time: Date.now() + 1800 * 1000,
    };
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

  dealWithLoginData: async (record: any, token: string) => {
    const username = record.username;
    const newToken = await utils.refreshToken(record.uuid, token);
    const data = {
      token: newToken,
      username,
    };
    return data;
  },

  formatDate: (fmt: string, timestamp?: number) => {
    let self = new Date();
    if (timestamp) {
      self = new Date(timestamp);
    }
    const o = {
      'M+': self.getMonth() + 1, //月份
      'd+': self.getDate(), //日
      'h+': self.getHours(), //小时
      'm+': self.getMinutes(), //分
      's+': self.getSeconds(), //秒
      'q+': Math.floor((self.getMonth() + 3) / 3), //季度
      S: self.getMilliseconds(), //毫秒
    };
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (self.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (const k in o) {
      if (new RegExp('(' + k + ')').test(fmt)) {
        //@ts-ignore
        fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
      }
    }
    return fmt;
  },

  checkDataType: (data: string, type: string) => {
    return Object.prototype.toString.call(data) === `[object ${type}]`;
  },

  checkDbCondition: ({ condition, collectionName }: { condition: any; collectionName: string }) => {
    if (Object.prototype.toString.call(condition) !== '[object Object]') {
      return 'param must be an object';
    } else if (!collectionName) {
      return 'collectionName must be valid string';
    } else {
      return '';
    }
  },

  countRunningTineFunc: (launchTime: number) => {
    let text = '';
    const minusValue = Math.ceil((Date.now() - launchTime) / 1000);
    if (minusValue < 60) {
      text = `${minusValue}s`;
    } else if (minusValue < 60 * 60) {
      text = `${Math.floor(minusValue / 60)}m ${minusValue % 60}s`;
    } else if (minusValue < 60 * 60 * 24) {
      const leftValue = minusValue % (60 * 60);
      text = `${Math.floor(minusValue / 60 / 60)}h ${Math.floor(leftValue / 60)}m ${leftValue % 60}s`;
    } else if (minusValue < 60 * 60 * 24 * 30) {
      const leftValue1 = minusValue % (60 * 60 * 24);
      const leftValue2 = leftValue1 % (60 * 60);
      text = `${Math.floor(minusValue / 60 / 60 / 24)}d ${Math.floor(leftValue1 / 60 / 60)}h ${Math.floor(
        leftValue2 / 60,
      )}m  ${leftValue2 % 60}s`;
    } else if (minusValue < 60 * 60 * 24 * 30 * 12) {
      const leftValue1 = minusValue % (60 * 60 * 24 * 30);
      const leftValue2 = leftValue1 % (60 * 60 * 24);
      const leftValue3 = leftValue1 % (60 * 60);
      text = `${Math.floor(minusValue / 60 / 60 / 24 / 30)}M ${Math.floor(leftValue1 / 60 / 60 / 24)}d ${Math.floor(
        leftValue2 / 60 / 60,
      )}h ${Math.floor(leftValue3 / 60)}m ${leftValue3 % 60}s`;
    } else if (minusValue < 60 * 60 * 24 * 30 * 12 * 100) {
      const leftValue1 = minusValue % (60 * 60 * 24 * 30 * 12);
      const leftValue2 = leftValue1 % (60 * 60 * 24 * 30);
      const leftValue3 = leftValue2 % (60 * 60 * 24);
      const leftValue4 = leftValue2 % (60 * 60);
      text = `${Math.floor(minusValue / 60 / 60 / 24 / 30 / 12)}Y ${Math.floor(
        leftValue1 / 60 / 60 / 24 / 30,
      )}M ${Math.floor(leftValue2 / 60 / 60 / 24)}d ${Math.floor(leftValue3 / 60 / 60)}h ${Math.floor(
        leftValue4 / 60,
      )}m ${leftValue4 % 60}s`;
    } else {
      text = `${minusValue}s`;
    }
    return text;
  },
};

export default utils;
