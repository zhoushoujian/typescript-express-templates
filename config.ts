const CONF = {
  DEBUG: false,
  APP_PORT: 8888,
  MONGO: "mongodb://charm:shuyun123@localhost:27017?authSource=charm&w=1",
  DATABASE: "shuyun",
  COLLECTION_USER: "user",
  COLLECTION_KYLIN: "kylin",
  ANTI_SPIDER_TIMES: 300,
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  REDIS_PWD: 'shuyun123',
  TOKEN_ENCRYPT_KEY: 'shuyun123',
  TOKEN_EXPIRED_TIME: 1800,
  SERVER_HEALTH_CHECK_TIMER: 3000,
  RSS_WARN: 500 * 1024 * 1024,
  HEAP_WARN: 450 * 1024 * 1024,
};

export default CONF
