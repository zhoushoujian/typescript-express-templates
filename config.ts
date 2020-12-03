const CONF = {
  DEBUG: false,
  APP_PORT: 8888,
  MONGO: "mongodb://charm:123456@localhost:27017?authSource=charm&w=1",
  MONGO_DEBUG: "mongodb://localhost:27017?authSource=charm&w=1",
  COLLECTION_INFOS: "collections",
  DATABASE: "charm",
  COLLECTION_USER: "user",
  ANTI_SPIDER_TIMES: 300,
  REDIS_HOST: "localhost",
  REDIS_HOST_DEBUG: "localhost",
  REDIS_PORT: "6379",
  REDIS_PWD: '123456',
  TOKEN_ENCRYPT_KEY: 'charm',
  TOKEN_EXPIRED_TIME: 1800,
  LOGIN_FOR_CACHE: "loginVerify",
  TOKEN_FOR_CACHE: "tk",
  LOGIN_ERROR_TIMES: 6,
  EXPIRE_LOGIN_TIME: 600,
};

export default CONF
