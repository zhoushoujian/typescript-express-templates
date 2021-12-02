import * as express from 'express';
import { checkLoginErrorTimes, validParam } from '@/utils/middleware';
import { IRequest } from '@/@types/common';
import parameter from '@/@types/parameter';
import { loginVerify, tokenLogin, registerVerify, refreshTokenFunc, resetPassword } from './login';

// eslint-disable-next-line new-cap
const router = express.Router();

router.post(
  '/login_verify',
  (req: IRequest, res: express.Response, next: express.NextFunction) =>
    validParam(req, res, next, parameter.loginVerify),
  checkLoginErrorTimes,
  loginVerify,
);
router.post('/token_login', tokenLogin);
router.post(
  '/register_verify',
  (req: IRequest, res: express.Response, next: express.NextFunction) =>
    validParam(req, res, next, parameter.registerVerify),
  registerVerify,
);
router.post('/refresh_token', refreshTokenFunc);
router.put(
  '/reset_password',
  (req: IRequest, res: express.Response, next: express.NextFunction) =>
    validParam(req, res, next, parameter.resetPassword),
  resetPassword,
);

// 路由入口
const index = (app: express.Application) =>
  app.use('/', (req: IRequest, res: express.Response, next: express.NextFunction) => router(req, res, next));

export default index;
