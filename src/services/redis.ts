import CONF from '../config';
import logger from '../utils/logger';

const redis = require('redis');

const redisClient = redis.createClient({
  port: CONF.REDIS_PORT,
  host: process.env.NODE_ENV === 'production' ? CONF.REDIS_HOST : CONF.REDIS_HOST_DEBUG,
  // eslint-disable-next-line camelcase
  auth_pass: CONF.REDIS_PWD,
});
redisClient.on('connect', () => {
  logger.info('redis => connect');
});
redisClient.on('ready', () => {
  logger.info('redis => ready');
});
redisClient.on('error', function (err: Error) {
  logger.error('redisClient onError ', err);
});

export const getCacheValue = (key: string): any => {
  return new Promise((res, rej) => {
    return redisClient.get(key, (err: Error, result: string) => {
      if (err) {
        logger.error('getCacheValue err', err);
        rej(err);
      } else {
        try {
          result = JSON.parse(result);
        } catch (err) {
          //
        } finally {
          res(result);
        }
      }
    });
  });
};

export const setCacheValue = (key: string, value: string | any) => {
  return new Promise((res, rej) => {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    redisClient.set(key, value, (err: Error) => {
      if (err) {
        logger.error('setCacheValue err', err);
        rej(err);
      } else {
        res('success');
      }
    });
  });
};

export const delCacheValue = (key: string) => {
  return new Promise((res, rej) => {
    return redisClient.del(key, (err: Error) => {
      if (err) {
        logger.error('delCacheValue err', err);
        rej(err);
      } else {
        res('success');
      }
    });
  });
};

export const expireCacheValue = (key: string, time: number) => {
  return new Promise((res, rej) => {
    return redisClient.expire(key, time, (err: Error, isSuccess: boolean) => {
      if (err || !isSuccess) {
        logger.error('redisClient.expire error', err);
        rej(err);
      } else {
        res(isSuccess);
      }
    });
  });
};

export default redisClient;
