import CONF from "../config";
import logger from "./logger";

const redis = require('redis')

const redisClient = redis.createClient({
  port: CONF.REDIS_PORT,
  host: CONF.REDIS_HOST,
  // eslint-disable-next-line camelcase
  auth_pass: CONF.REDIS_PWD
});
redisClient.on('connect', () => {
  console.log('connect');
});
redisClient.on('ready', () => {
  console.log('ready');
});
redisClient.on("error", function (err) {
  logger.error("redisClient onError ", err);
});

export default redisClient
