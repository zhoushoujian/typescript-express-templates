/* eslint-disable require-atomic-updates */
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import * as uuid from 'uuid';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as checkDependenceVersion from '@shuyun-ep-team/specified-package-version-check';
import utils from '@/utils/utils';
import antiSpider from '@/anti-spider';
import CONF from '@/config';
import logger from '@/utils/logger';
import { jwtVerify, tokenExpiredFunc } from '@/utils/middleware';
import routers from '@/routes';
import { getCacheValue, setCacheValue } from '@/services/redis';
import { IRequest } from '@/@types/common';

(checkDependenceVersion as any)({
  dependenceArr: ['@shuyun-ep-team/eslint-config', '@shuyun-ep-team/specified-package-version-check', 'beauty-logger'],
  ignoreCheck: CONF.IS_PRODUCTION,
  onlyWarn: CONF.IS_PRODUCTION,
  useDepCheck: true,
  autoFixOutdateDep: true,
}).then(() => {
  const app = express();
  const httpServer = http.createServer(app);

  if (!fs.existsSync(path.join(__dirname, '../logs'))) {
    fs.mkdirSync(path.join(__dirname, '../logs'));
  }

  //获取ip地址
  let address: string;
  const networks: any = os.networkInterfaces();
  Object.keys(networks).forEach(function (k) {
    for (const kk in networks[k]) {
      if (networks[k][kk].family === 'IPv4' && networks[k][kk].address !== '127.0.0.1') {
        address = networks[k][kk].address;
      }
    }
  });

  app.use(bodyParser.json());
  //Remove x-powered-by header
  app.disable('x-powered-by');
  app.use(
    bodyParser.urlencoded({
      extended: false,
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
    }),
  );
  let i = 0; //统计服务器的的访问次数
  //设置允许跨域访问该服务.
  app.all('*', async function (req: IRequest, res: express.Response, next: express.NextFunction) {
    req.id = uuid.v4();
    req.now = Date.now();
    if (req.url === '/assets/favicon.ico' || req.url === '/favicon.ico') {
      return res.end();
    }
    let count = await getCacheValue('visitCount');
    if (!count) {
      count = 0;
    }
    count = count + 1;
    await setCacheValue('visitCount', count);
    logger.info(` server  收到客户端的请求数量`, req.url, req.method, ++i, utils.getIp(req, ''));
    res.header('Access-Control-Allow-Origin', '*');
    //Access-Control-Allow-Headers ,可根据浏览器的F12查看,把对应的粘贴在这里就行
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, authorization, xfilecategory, xfilename, xfilesize, Content-Length, Accept, X-Requested-With',
    );
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Content-Type', 'application/json;charset=utf-8');
    res.header('Access-Control-Expose-Headers', 'Authorization');
    return next();
  });

  app.use(function (req: IRequest, res: express.Response, next: express.NextFunction) {
    req.method === 'OPTIONS' ? res.status(204).end() : next();
  });

  // anti spider
  app.use(antiSpider);

  app.all('*', async function (req: IRequest, res: express.Response, next: express.NextFunction) {
    const reqUrls = ['/login_verify', '/', '/heart_beat'];
    if (!reqUrls.includes(req.url)) {
      const token = req.headers.authorization || '';
      const cacheTokenKey = await getCacheValue(`${CONF.TOKEN_FOR_CACHE}: ${token}`);
      if (!cacheTokenKey) {
        return tokenExpiredFunc(res, 401, 'token已过期');
      }
      return jwtVerify(token, res, async function (decoded) {
        logger.info('decoded.uuid', decoded, 'req.url', req.url);
        const now = Math.ceil(Date.now() / 1000);
        //自动刷新token
        if (decoded.exp - now < 300) {
          logger.info('decoded.exp - now < 300, decoded', decoded);
          const uuid = decoded.uuid;
          const newToken = await utils.refreshToken(uuid, token);
          //@ts-ignore
          req.query.token = newToken;
          req.body.token = newToken;
        }
        next();
      });
    } else {
      return next();
    }
  });

  // heart beat
  app.get('/', heartBeat);
  app.get('/heart_beat', heartBeat);

  // route
  routers(app);

  //handle 404
  app.use(function (req: IRequest, res: express.Response) {
    logger.info('404 not found, req.url', req.url);
    const response = {
      status: 'FAILURE',
      result: {
        errCode: 404,
        errText: '404: Not Found',
      },
    };
    return res.status(404).send(JSON.stringify(response));
  });

  const launchTime = Date.now();
  async function heartBeat(req: IRequest, res: express.Response) {
    logger.info('heartBeat success', utils.formatDate('yyyy-MM-dd hh:mm:ss'));
    const count = await getCacheValue('visitCount');
    const responseObj = {
      date: utils.formatDate('yyyy-MM-dd hh:mm:ss'),
      apiCount: `已响应${count}次请求`,
      runningTime: utils.countRunningTineFunc(launchTime),
    };
    return utils.writeResponse(req, res, responseObj);
  }

  // http监听8888端口
  httpServer.listen(CONF.APP_PORT, () => {
    logger.info(
      `主服务${address}启动成功,正在监听${CONF.APP_PORT}端口, http${CONF.IS_PRODUCTION ? 's' : ''}://${address}:${
        CONF.APP_PORT
      }`,
    );
    process.title = `主服务${address}启动成功,正在监听${CONF.APP_PORT}端口`;
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('uncaughtException child process', error.stack);
  });

  process.on('unhandledRejection', (error: Error) => {
    logger.error('unhandledRejection child process', error.stack);
  });
});
