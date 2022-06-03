import * as uuid from 'uuid';
import * as express from 'express';
import utils from '../utils/utils';
import mongoSink from '../services/mongoSink';
import logger from '../utils/logger';
import { jwtVerify } from '../utils/middleware';
import CONF from '../config';
import { getCacheValue, setCacheValue, delCacheValue, expireCacheValue } from '../services/redis';
import { IRequest } from '../@types/common';

interface ICacheInfo {
  username: string;
  times: number;
}

const loginErrorTimesTip = (cacheInfo: ICacheInfo) => {
  if (CONF.LOGIN_ERROR_TIMES - cacheInfo.times - 1 > 0) {
    return `还剩下${CONF.LOGIN_ERROR_TIMES - cacheInfo.times - 1}次机会`;
  } else {
    return '账户已锁定，请稍候再试';
  }
};

const setLoginErrorInfoCache = async (
  cacheKey: string,
  username: string,
  times: number,
  req: IRequest,
  res: express.Response,
  cacheInfo: ICacheInfo,
) => {
  await setCacheValue(cacheKey, { username, times });
  await expireCacheValue(cacheKey, CONF.EXPIRE_LOGIN_TIME);
  return utils.reportInvokeError(
    req,
    res,
    cacheInfo && cacheInfo.times > 2 ? `用户名或密码不正确，${loginErrorTimesTip(cacheInfo)}` : '用户名或密码不正确',
  );
};

export async function loginVerify(req: IRequest, res: express.Response) {
  try {
    const { username, pwd } = req.body;
    logger.info('login_verify username pwd', username, pwd);
    const cacheKey = `${CONF.LOGIN_FOR_CACHE}: ${username}`;
    const cacheInfo: ICacheInfo = await getCacheValue(cacheKey);
    const times = cacheInfo ? cacheInfo.times + 1 : 1;
    const result = await mongoSink.find({ username }, {}, 'userInfo');
    if (!result.length) {
      logger.warn('login_verify  用户名错误！ username', username);
      return setLoginErrorInfoCache(cacheKey, username, times, req, res, cacheInfo);
    }
    const record = result[0];
    const dbPassword = record.password;
    const salt = record.salt;
    if (!salt || !dbPassword) {
      logger.warn('login_verify no db_password salt');
      return setLoginErrorInfoCache(cacheKey, username, times, req, res, cacheInfo);
    }
    const password = utils.encryptAES(pwd, salt);
    if (password !== dbPassword) {
      logger.warn('login_verify  密码错误！username', username);
      return setLoginErrorInfoCache(cacheKey, username, times, req, res, cacheInfo);
    } else {
      delCacheValue(cacheKey);
      const sendData = await utils.dealWithLoginData(record, '');
      return utils.writeResponse(req, res, sendData);
    }
  } catch (err: any) {
    logger.error('loginVerify err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

export function tokenLogin(req: IRequest, res: express.Response) {
  try {
    const token = req.headers.authorization as string;
    return jwtVerify(token, res, function (decoded) {
      const uuid = decoded.uuid;
      logger.info('tokenLogin uuid', uuid);
      if (!uuid) {
        return utils.reportInvokeError(req, res, '用户不存在');
      }
      return mongoSink
        .find({ uuid }, {}, 'userInfo')
        .then(async (result: any[]) => {
          const record = result[0];
          if (record) {
            const sendData = await utils.dealWithLoginData(record, token);
            return utils.writeResponse(req, res, sendData);
          } else {
            logger.warn('tokenLogin uuid', uuid);
            return utils.reportInvokeError(req, res, '没有这个用户');
          }
        })
        .catch((err: Error) => {
          logger.error('token_login userMongoSink.find catch err', err.stack || err.toString());
          return utils.reportError(req, res, err);
        });
    });
  } catch (err: any) {
    logger.error('token_login out catch err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

export async function registerVerify(req: IRequest, res: express.Response) {
  try {
    const { username } = req.body;
    logger.info('registerVerify username', username);
    if (username.length > 32) {
      return utils.reportInvokeError(req, res, '用户名长度应小于32位');
    } else if (/^[0-9]/i.test(username)) {
      return utils.reportInvokeError(req, res, '用户名第一个字符不能是数字');
    } else if (!/^[\u4e00-\u9fa5_a-zA-Z0-9]+$/.test(username)) {
      return utils.reportInvokeError(req, res, '用户名只能是数字字母下划线或中文');
    }
    return mongoSink.find({ username }, {}, 'userInfo').then(async (result: any[]) => {
      logger.info('registerVerify result.length', result.length);
      if (result.length) {
        logger.warn('register_verify  用户名已存在！');
        return utils.reportInvokeError(req, res, '用户名已存在！');
      } else {
        const salt = Buffer.from(utils.generateString(32), 'utf8').toString('hex');
        const pwd = Math.random().toString(36).slice(5) + Date.now().toString(36);
        const password = utils.encryptAES(pwd, salt);
        const obj = {
          password,
          salt,
          uuid: uuid.v4(),
        };
        return mongoSink.update({ username }, obj, true, 'userInfo').then(() => {
          logger.info('registerVerify success username, pwd', username, pwd);
          const responseObj = {
            response: 'success',
            password: pwd,
          };
          return utils.writeResponse(req, res, responseObj);
        });
      }
    });
  } catch (err: any) {
    logger.error('register_verify  catch  err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

export function refreshTokenFunc(req: IRequest, res: express.Response) {
  try {
    const token = req.headers.authorization as string;
    return jwtVerify(token, res, async function (decoded) {
      const uuid = decoded.uuid;
      logger.info('refreshTokenFunc uuid', uuid);
      const responseObj = { token: {} };
      responseObj.token = await utils.refreshToken(uuid, token);
      return utils.writeResponse(req, res, responseObj);
    });
  } catch (err: any) {
    logger.error('refreshTokenFunc err', err);
    return utils.reportError(req, res, err);
  }
}

export async function resetPassword(req: IRequest, res: express.Response) {
  const token = req.headers.authorization;
  const { oldPwd, newPwd } = req.body;
  try {
    return jwtVerify(token, res, async function (decoded) {
      const uuid = decoded.uuid;
      logger.info('resetPassword oldPwd, newPwd, uuid', oldPwd, newPwd, uuid);
      const result = await mongoSink.find({ uuid }, {}, 'userInfo');
      if (!result.length) {
        return utils.reportInvokeError(req, res, '用户名不存在');
      }
      const record = result[0];
      const dbPassword = record.password;
      const oldPassword = utils.encryptAES(oldPwd, record.salt);
      if (oldPassword !== dbPassword) {
        return utils.reportInvokeError(req, res, '原密码不正确');
      }
      if (!/^(?=(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*\d)|(?=.*[A-Z])(?=.*\d))[^]{6,16}$/.test(newPwd)) {
        return utils.reportInvokeError(req, res, '新密码必须包含大小写字母或数字中的两种且不低于6位数');
      }
      const salt = Buffer.from(utils.generateString(32), 'utf8').toString('hex');
      const password = utils.encryptAES(newPwd, salt);
      return mongoSink.update({ uuid }, { password, salt }, true, 'userInfo').then(async (result: any) => {
        logger.info('resetPassword userMongoSink update result.result', result.result);
        if (result.result.ok === 1 && result.result.nModified === 1) {
          const newToken = await utils.refreshToken(uuid, token as string);
          const obj = Object.assign({}, { token: newToken, result: 'reset_success' });
          logger.info('resetPassword success');
          return utils.writeResponse(req, res, obj);
        } else {
          logger.error('resetPassword token userMongoSink.update error, result', result);
          return utils.reportError(req, res, result);
        }
      });
    });
  } catch (err: any) {
    logger.error('resetPassword err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}
