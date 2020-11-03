import login from './login'
// const sdk = require('./sdk');

const router = (app) => {
  app.use('/monitor/v1/', (req, res, next) => {
    // 登录
    login(req, res, next)
    // sdk
    // sdk(req, res, next)
  })
};

export default router;
