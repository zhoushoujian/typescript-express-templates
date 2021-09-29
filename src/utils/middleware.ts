import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import CONF from '../config';
import logger from './logger';
import utils from './utils';
import { getCacheValue } from '../services/redis';
import { IRequest } from '../@types/common';

export const tokenExpiredFunc = (res: express.Response, errCode: number, errText: any) => {
  const wrapper = JSON.stringify({
    status: 'FAILURE',
    result: {
      errCode,
      errText,
    },
  });
  let tmpBuf: any = Buffer.from(wrapper);
  const headers = {
    'content-length': tmpBuf.length,
    'content-type': 'application/json',
  };
  res.writeHead(401, headers);
  res.write(tmpBuf);
  res.end();
  tmpBuf = null;
  return;
};

export const jwtVerify = (token: string | undefined, res: express.Response, cb: (a: any) => void) => {
  return jwt.verify(token!, CONF.TOKEN_ENCRYPT_KEY, (err, decoded) => {
    if (err) {
      logger.error('jwt.verify  err', err.stack || err.toString());
      //解析token是否过期 和是否是正确的token,若时间长无操作而过期则给出提示
      if (
        err.name === 'TokenExpiredError' ||
        err.message === 'jwt expired' ||
        err.message === 'jwt malformed' ||
        !token
      ) {
        return tokenExpiredFunc(res, 401, 'token_expired');
      } else {
        return tokenExpiredFunc(res, 500, err.stack || err.toString());
      }
    } else {
      if (cb) {
        cb(decoded);
      }
    }
  });
};

export const checkRequestParam = (method: string, params: string[], message: string) => {
  return (req: IRequest, res: express.Response, next: express.NextFunction) => {
    let flag = 'flag';
    const content = method === 'get' || method === 'delete' ? req.query : req.body;
    if (!Array.isArray(params)) {
      return utils.reportError(req, res, new Error('params is not an array'));
    } else {
      params.some(item => {
        if (content[item] === undefined) {
          flag = '';
          return true;
        } else {
          return false;
        }
      });
      if (!flag) {
        logger.warn('checkRequestParam no flag method, params, message', method, params, message);
        return utils.reportInvokeError(req, res, message);
      } else {
        next();
      }
    }
  };
};

export const checkLoginErrorTimes = async (req: IRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { username } = req.body;
    const cacheInfo: any = await getCacheValue(`${CONF.LOGIN_FOR_CACHE}: ${username}`);
    if (!cacheInfo || cacheInfo.times < CONF.LOGIN_ERROR_TIMES) {
      next();
    } else {
      logger.warn('checkLoginErrorTimes  用户名已锁定！ username', username);
      return utils.reportInvokeError(req, res, '用户名已锁定，请稍候再试');
    }
  } catch (err) {
    logger.error('searchFieldForDetail err', err);
    return utils.reportError(req, res, err);
  }
};
