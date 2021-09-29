import * as express from 'express';
import utils from './utils/utils';
import CONF from './config';
import redisClient from './services/redis';
import logger from './utils/logger';
import { IRequest } from './@types/common';

const antiSpider = function (req: IRequest, res: express.Response, next: express.NextFunction) {
  const ip = utils.getIp(req, req.url);
  // eslint-disable-next-line complexity
  redisClient.get(`ip:${ip}`, (err: Error, result: string) => {
    try {
      if (err) {
        logger.error('antiSpider get err', err);
        throw err;
      }
      if (result) {
        const obj = JSON.parse(result);
        // 一分钟内超过300次访问
        if (obj.times > CONF.ANTI_SPIDER_TIMES && Date.now() - obj.date < 60000) {
          // 如果爬虫已经被block了，则继续屏蔽并给出报警
          if (obj.status === 'blocked') {
            logger.warn('spider continue to attack, ip', ip, 'second', (Date.now() - obj.date) / 1000);
            return utils.reportInvokeError(req, res, 'ip blocked');
          } else {
            // 爬虫首次被侦测出来，打印报警日志
            logger.warn('fond a spider, ip', ip, 'second', (Date.now() - obj.date) / 1000);
            obj.status = 'blocked';
            redisClient.set(`ip:${ip}`, JSON.stringify(obj));
            return utils.reportInvokeError(req, res, 'ip blocked');
          }
        } else {
          if (obj.status === 'blocked') {
            if (Date.now() - obj.date < 300000) {
              // 屏蔽爬虫5分钟，5分钟之内不允许爬虫访问服务器
              logger.warn('spider continue to attack, ip', ip, 'second', (Date.now() - obj.date) / 1000);
              return utils.reportInvokeError(req, res, 'ip blocked');
            } else {
              // 5分钟时间到，解除屏蔽
              obj.times = 1;
              obj.date = Date.now();
              obj.status = 'open';
              redisClient.set(`ip:${ip}`, JSON.stringify(obj));
              next();
            }
          } else if (obj.times > CONF.ANTI_SPIDER_TIMES) {
            // 正常的用户，访问次数达到100，时间间隔超过一分钟，重新计数
            obj.times = 1;
            obj.date = Date.now();
            obj.status = 'open';
            redisClient.set(`ip:${ip}`, JSON.stringify(obj));
            next();
          } else {
            // 正常的用户，统计访问次数
            obj.times += 1;
            redisClient.set(`ip:${ip}`, JSON.stringify(obj));
            next();
          }
        }
      } else {
        // 首次访问服务器的用户
        const obj = {
          times: 1,
          date: Date.now(),
          status: 'open',
        };
        redisClient.set(`ip:${ip}`, JSON.stringify(obj));
        next();
      }
    } catch (err: any) {
      logger.error('antiSpider run err', err.stack);
      return res.status(500).end(err.stack);
    }
  });
};

export default antiSpider;
