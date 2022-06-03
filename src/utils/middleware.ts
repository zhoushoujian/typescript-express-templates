import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as Parameter from 'parameter';
import CONF from '@/config';
import { getCacheValue } from '@/services/redis';
import { IRequest } from '@/@types/common';
import logger from './logger';
import utils from './utils';

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
        tokenExpiredFunc(res, 401, 'token_expired');
      } else {
        tokenExpiredFunc(res, 500, err.stack || err.toString());
      }
    } else {
      if (cb) {
        cb(decoded);
      }
    }
  });
};

export const checkLoginErrorTimes = async (req: IRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { username } = req.body;
    const cacheInfo: any = await getCacheValue(`${CONF.LOGIN_FOR_CACHE}: ${username}`);
    if (!cacheInfo || cacheInfo.times < CONF.LOGIN_ERROR_TIMES) {
      return next();
    } else {
      logger.warn('checkLoginErrorTimes  用户名已锁定！ username', username);
      return utils.reportInvokeError(req, res, '用户名已锁定，请稍候再试');
    }
  } catch (err: any) {
    logger.error('searchFieldForDetail err', err);
    return utils.reportError(req, res, err);
  }
};

export const validParam = (
  req: IRequest,
  res: express.Response,
  next: express.NextFunction,
  rules: Parameter.ParameterRules,
) => {
  try {
    const parameter = new Parameter();

    if (!rules) {
      return utils.reportError(req, res, new Error('rules cannot be undefined'));
    }

    const params = ['GET', 'HEAD', 'DELETE'].includes(req.method.toUpperCase()) ? req.query : req.body;
    const errors: Parameter.ValidateError[] | void = parameter.validate(rules, params);
    if (errors && errors.length) {
      logger.info('validParam errors', errors);
      return utils.reportInvokeError(req, res, errors.map(item => `${item.field}: ${item.message};`).join('\r\n'));
    } else {
      return next();
    }
  } catch (err) {
    logger.error('validParam err', err);
    return utils.reportError(req, res, err);
  }
};
