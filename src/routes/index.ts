import * as express from 'express';
import { validParam } from '../utils/middleware.ts';
import parameter from '../@types/parameter.ts';
import { loginVerify } from './login.ts';

// eslint-disable-next-line new-cap
const router = express.Router();

router.post(
  '/login',
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    validParam(req, res, next, parameter.loginVerify),
  loginVerify,
);
// 路由入口
const index = (app: express.Application) =>
  app.use('/', (req: express.Request, res: express.Response, next: express.NextFunction) => router(req, res, next));

export default index;
