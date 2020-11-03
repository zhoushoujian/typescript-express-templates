import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os'
import * as express from "express";
import * as bodyParser from 'body-parser'
import utils from './utils/utils'
import antiSpider from './antiSpider'
import CONF from './config'
import logger from './utils/logger'
import routers from './routes'
import kylinMongoSink from "./services/kylinMongoSink"
import "./utils/redis"
import "./services/userMongoSink"

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
); //这个是和get有关系的
let i = 0; //统计服务器的的访问次数
//设置允许跨域访问该服务.
app.all("*", function (req, res, next) {
  if (req.url === "/assets/favicon.ico" || req.url === "/favicon.ico") {
    return res.end();
  }
  logger.info(` server  收到客户端的请求数量`, req.url, req.method, ++i);
  res.header("Access-Control-Allow-Origin", "*");
  //Access-Control-Allow-Headers ,可根据浏览器的F12查看,把对应的粘贴在这里就行
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, authorization, xfilecategory, xfilename, xfilesize, Content-Length, Accept, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Content-Type", "application/json;charset=utf-8");
  res.header("Access-Control-Expose-Headers", "Authorization");
  utils.getIp(req, req.url);
  if (req.url.includes('/sdk/info')) {
    const info = {...req.query, ...req.body};
    console.log('info', info)
    info.date = Date.now()
    info.dateFormat = utils.format("yyyy-MM-dd hh:mm:ss");
    info.clientIP = utils.getIp(req, "errorLogs");
    return kylinMongoSink.insertOne(info, function (err, _result) {
      if (err) {
        logger.error("npmErrorLog insertOne  err", err);
        return utils.reportError(req, res, err);
      } else {
        return utils.writeResponse(res, {success: true}); 
      }
    });
  }
  const reqUrls = [
    "/monitor/v1/login_verify",
    "/",
    "/heart_beat",
  ]
  if (!reqUrls.includes(req.url) && req.method !== "OPTIONS") {
    utils.jwtVerify(req.headers.authorization, res, function (decoded) {
      logger.info("decoded.uuid", decoded, 'req.url', req.url);
      next();
    });
  } else {
    next();
  }
});

app.use(function (req, res, next) {
  req.method === "OPTIONS" ? res.status(204).end() : next();
});

// anti spider
app.use(antiSpider);

// heart beat
app.get("/", heartBeat);
app.get("/heart_beat", heartBeat);

// route
routers(app);

function heartBeat(_req, res) {
  logger.info("heartBeat success", utils.format("yyyy-MM-dd hh:mm:ss"));
  const responseObj = {
    date: utils.format("yyyy-MM-dd hh:mm:ss"),
  };
  return utils.writeResponse(res, responseObj);
}

// http监听8000端口
httpServer.listen(CONF.APP_PORT, () => {
  logger.info(`主服务${address}启动成功,正在监听${CONF.APP_PORT}端口`);
  process.title = `主服务${address}启动成功,正在监听${CONF.APP_PORT}端口`;
});

process.on("uncaughtException", (err) => {
  logger.error(
    "uncaughtException child process",
    err.stack || err.toString()
  );
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  logger.error("unhandledRejection child process", error);
  process.exit(0);
});
