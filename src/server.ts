import * as http from 'http';
import * as os from 'os';
import express from 'express';
import * as bodyParser from 'body-parser';
import utils from '@/utils/utils';
import CONF from '@/config';
import routers from '@/routes';

const app = express();
const httpServer = http.createServer(app);

// http监听8888端口
httpServer.listen(CONF.APP_PORT, () => {
  console.info(
    `服务${address}启动成功,正在监听${CONF.APP_PORT}端口, http${CONF.IS_PRODUCTION ? 's' : ''}://${address}:${CONF.APP_PORT}`,
  );
  process.title = `服务${address}启动成功,正在监听${CONF.APP_PORT}端口`;
});

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
app.all('*', function (req, res, next) {
  if (req.url === '/assets/favicon.ico' || req.url === '/favicon.ico') {
    return res.end();
  }
  console.info(` server  收到客户端的请求数量`, req.url, req.method, ++i, utils.getIp(req, ''));
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

app.use(function (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.method === 'OPTIONS' ? res.status(204).end() : next();
});

// heart beat
app.get('/', heartBeat);
app.get('/heart_beat', heartBeat);

// route
routers(app);

//handle 404
app.use(function (req: express.Request, res: express.Response) {
  console.info('404 not found, req.url', req.url);
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
async function heartBeat(req: express.Request, res: express.Response) {
  console.info('heartBeat success', utils.formatDate('yyyy-MM-dd hh:mm:ss'));
  const responseObj = {
    date: utils.formatDate('yyyy-MM-dd hh:mm:ss'),
    runningTime: utils.countRunningTineFunc(launchTime),
  };
  return utils.writeResponse(req, res, responseObj);
}

process.on('uncaughtException', (error: Error) => {
  console.error('uncaughtException child process', error.stack);
});

process.on('unhandledRejection', (error: Error) => {
  console.error('unhandledRejection child process', error.stack);
});
