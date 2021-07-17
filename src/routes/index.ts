import * as express from 'express';
import { loginVerify, tokenLogin, registerVerify, refreshTokenFunc, resetPassword } from './login';
import { checkRequestParam, checkLoginErrorTimes } from '../utils/middleware';

// eslint-disable-next-line new-cap
const router = express.Router();

router.post(
  '/login_verify',
  checkRequestParam('post', ['username', 'pwd'], '用户名或密码不能为空'),
  checkLoginErrorTimes,
  loginVerify,
);
router.post('/token_login', tokenLogin);
router.post('/register_verify', checkRequestParam('post', ['username'], '用户名不能为空'), registerVerify);
router.post('/refresh_token', refreshTokenFunc);
router.put('/reset_password', checkRequestParam('post', ['oldPwd', 'newPwd'], '原密码或新密码不能为空'), resetPassword);

// 路由入口
const index = app => app.use('/', (req, res, next) => router(req, res, next));

export default index;
