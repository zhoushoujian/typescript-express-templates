import utils from "./utils/utils";
import CONF from "./config";
import redisClient from "./services/redis";
import logger from "./utils/logger";

const antiSpider = function (req, res, next) {
  const ip = utils.getIp(req, req.url);
  // eslint-disable-next-line complexity
  redisClient.get(`ip:${ip}`, (err, result) => {
    try {
      if (err) {
        logger.error("antiSpider get err", err);
        throw err;
      }
      if (result) {
        result = JSON.parse(result);
        // 一分钟内超过300次访问
        if (result.times > CONF.ANTI_SPIDER_TIMES && (Date.now() - result.date < 60000)) {
          // 如果爬虫已经被block了，则继续屏蔽并给出报警
          if (result.status === 'blocked') {
            logger.warn("spider continue to attack, ip", ip, 'second', (Date.now() - result.date) / 1000);
            return utils.reportError(req, res, "ip blocked");
          } else {
            // 爬虫首次被侦测出来，打印报警日志
            logger.warn("fond a spider, ip", ip, 'second', (Date.now() - result.date) / 1000);
            result.status = 'blocked';
            redisClient.set(`ip:${ip}`, JSON.stringify(result));
            return utils.reportError(req, res, "ip blocked");
          }
        } else {
          if (result.status === 'blocked') {
            if (Date.now() - result.date < 300000) {
              // 屏蔽爬虫5分钟，5分钟之内不允许爬虫访问服务器
              logger.warn("spider continue to attack, ip", ip, 'second', (Date.now() - result.date) / 1000);
              return utils.reportError(req, res, "ip blocked");
            } else {
              // 5分钟时间到，解除屏蔽
              result.times = 1;
              result.date = Date.now();
              result.status = 'open';
              redisClient.set(`ip:${ip}`, JSON.stringify(result));
              next();
            }
          } else if (result.times > CONF.ANTI_SPIDER_TIMES) {
            // 正常的用户，访问次数达到100，时间间隔超过一分钟，重新计数
            result.times = 1;
            result.date = Date.now();
            result.status = 'open';
            redisClient.set(`ip:${ip}`, JSON.stringify(result));
            next();
          } else {
            // 正常的用户，统计访问次数
            result.times += 1;
            redisClient.set(`ip:${ip}`, JSON.stringify(result));
            next();
          }
        }
      } else {
        // 首次访问服务器的用户
        const obj = {
          times: 1,
          date: Date.now(),
          status: 'open'
        };
        redisClient.set(`ip:${ip}`, JSON.stringify(obj));
        next();
      }
    } catch (err) {
      logger.error("antiSpider run err", err);
      return res.status(500).end(err.stack || err.toString());
    }
  });
};

export default antiSpider;
