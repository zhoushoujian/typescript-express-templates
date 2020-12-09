import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os'
import * as uuid from 'uuid'
import * as express from "express";
import * as bodyParser from 'body-parser'
import utils from './utils/utils'
import antiSpider from './antiSpider'
import CONF from './config'
import logger from './utils/logger'
import { jwtVerify, tokenExpiredFunc } from "./utils/middleware"
import routers from './routes'
import { getCacheValue } from "./services/redis"

const app = express();
const httpServer = http.createServer(app)

if (!fs.existsSync(path.join(__dirname, "./logs"))) {
  fs.mkdirSync(path.join(__dirname, "./logs"));
}

//获取ip地址
let address: string;
const networks: any = os.networkInterfaces();
Object.keys(networks).forEach(function (k) {
  for (const kk in networks[k]) {
    if (
      networks[k][kk].family === "IPv4" &&
      networks[k][kk].address !== "127.0.0.1"
    ) {
      address = networks[k][kk].address;
      return address;
    }
  }
});

app.use(bodyParser.json());
//Remove x-powered-by header
app.disable("x-powered-by");
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(
  express.urlencoded({
    extended: false,
  })
);
let i = 0; //统计服务器的的访问次数
//设置允许跨域访问该服务.
app.all("*", function (req, res, next) {
  (req as any).id = uuid.v4()
  if (req.url === "/assets/favicon.ico" || req.url === "/favicon.ico") {
    return res.end();
  }
  logger.info(` server  收到客户端的请求数量`, req.url, req.method, ++i, utils.getIp(req, ""));
  res.header("Access-Control-Allow-Origin", "*");
  //Access-Control-Allow-Headers ,可根据浏览器的F12查看,把对应的粘贴在这里就行
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, authorization, xfilecategory, xfilename, xfilesize, Content-Length, Accept, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Content-Type", "application/json;charset=utf-8");
  res.header("Access-Control-Expose-Headers", "Authorization");
  next()
});

app.use(function (req, res, next) {
  req.method === "OPTIONS" ? res.status(204).end() : next();
});

// anti spider
app.use(antiSpider);

app.all("*", async function (req, res, next) {
  const reqUrls = [
    "/login_verify",
    "/",
    "/heart_beat",
  ]
  if (!reqUrls.includes(req.url)) {
    const token = req.headers.authorization
    const cacheTokenKey = await getCacheValue(`${CONF.TOKEN_FOR_CACHE}: ${token}`)
    if (!cacheTokenKey) {
      return tokenExpiredFunc(res, 401, "token已过期")
    }
    jwtVerify(token, res, function (decoded) {
      logger.info("decoded.uuid", decoded, 'req.url', req.url);
      next();
    });
  } else {
    next();
  }
})

// heart beat
app.get("/", heartBeat);
app.get("/heart_beat", heartBeat);

// route
routers(app);

//handle 404
app.use(function (req, res) {
  logger.info("404 not found, req.url", req.url)
  return res.status(404).send('404: Not Found');
})

function heartBeat(_req, res) {
  logger.info("heartBeat success", utils.formatDate("yyyy-MM-dd hh:mm:ss"));
  const responseObj = {
    date: utils.formatDate("yyyy-MM-dd hh:mm:ss"),
  };
  return utils.writeResponse(res, responseObj);
}

// http监听8888端口
httpServer.listen(CONF.APP_PORT, () => {
  logger.info(`主服务${address}启动成功,正在监听${CONF.APP_PORT}端口`);
  process.title = `主服务${address}启动成功,正在监听${CONF.APP_PORT}端口`;
});

process.on("uncaughtException", (err) => {
  logger.error("uncaughtException child process", err.stack || err.toString());
});

process.on("unhandledRejection", (error) => {
  logger.error("unhandledRejection child process", error);
});
