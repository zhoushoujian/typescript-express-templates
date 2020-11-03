import * as express from 'express'
import * as uuid from 'uuid'
import utils from '../utils/utils'
import userMongoSink from '../services/userMongoSink'
import logger from '../utils/logger'

// eslint-disable-next-line new-cap
const router = express.Router();

router.post("/login_verify", loginVerify);
router.post("/token_login", tokenLogin);
router.post("/register_verify", registerVerify);
router.post("/refresh_token", refreshTokenFunc);
router.put("/reset_password", resetPassword);

async function loginVerify(req, res) {
  try {
    const { username, pwd } = req.body;
    logger.info("login_verify username pwd", username, pwd);
    if (!username || !pwd) {
      logger.warn("login_verify  用户名或密码不能为空！");
      return utils.reportInvokeError(req, res, "用户名或密码不能为空");
    }
    const result = await userMongoSink.find({ username });
    if (!result.length) {
      logger.warn("login_verify  用户名错误！ username", username);
      return utils.reportInvokeError(req, res, "用户名或密码不正确");
    }
    const record = result[0];
    const dbPassword = record.password;
    const salt = record.salt;
    if (!salt || !dbPassword) {
      logger.warn("login_verify no db_password salt");
      return utils.reportInvokeError(req, res, "用户名或密码不正确");
    }
    const password = utils.encryptAES(pwd, salt);
    if (password !== dbPassword) {
      logger.warn("login_verify  密码错误！username", username);
      return utils.reportInvokeError(req, res, "用户名或密码不正确");
    } else {
      const sendData = utils.dealWithLoginData(record)
      return utils.writeResponse(res, sendData);
    }
  } catch (err) {
    logger.error("loginVerify err", err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

function tokenLogin(req, res) {
  try {
    const token = req.headers.authorization
    utils.jwtVerify(token, res, function (decoded) {
      const uuid = decoded.uuid;
      logger.info("tokenLogin uuid", decoded);
      if (!uuid) {
        return utils.reportInvokeError(req, res, "用户不存在");
      }
      const token = utils.refreshToken(uuid);
      return userMongoSink.find({ uuid })
        .then(async (result) => {
          const record = result[0];
          if (record) {
            const sendData = utils.dealWithLoginData(record)
            sendData.token = token;
            return utils.writeResponse(res, sendData);
          } else {
            logger.warn("tokenLogin uuid", uuid);
            return utils.reportInvokeError(req, res, "没有这个用户");
          }
        })
        .catch(err => {
          logger.error('token_login userMongoSink.find catch err', err.stack || err.toString());
          return utils.reportError(req, res, err);
        });
    });
  } catch (err) {
    logger.error('token_login out catch err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

async function registerVerify(req, res) {
  try {
    const data = req.body;
    const { username } = data;
    if (!username) {
      return utils.reportInvokeError(req, res, "用户名不能为空");
    }
    if (username.length > 32) {
      return utils.reportInvokeError(req, res, "用户名长度应小于32位");
    } else if (/^[0-9]/i.test(username)) {
      return utils.reportInvokeError(req, res, "用户名第一个字符不能是数字");
    } else if (!/^[\u4e00-\u9fa5_a-zA-Z0-9]+$/.test(username)) {
      return utils.reportInvokeError(req, res, "用户名只能是数字字母下划线或中文");
    }
    await userMongoSink.find({ username })
      .then(async (result) => {
        logger.info("registerVerify result.length", result.length);
        if (result.length) {
          logger.warn("register_verify  用户名已存在！");
          return utils.reportInvokeError(req, res, "用户名已存在！");
        } else {
          const salt = Buffer.from(utils.generateString(32), 'utf8').toString('hex');
          const pwd = Math.random().toString(36).slice(5) + Date.now().toString(36)
          const password = utils.encryptAES(pwd, salt);
          const obj = {
            password,
            salt,
            uuid: uuid.v4()
          };
          await userMongoSink.update({ username }, obj)
            .then(() => {
              logger.info("registerVerify success");
              const responseObj = {
                response: "success",
                password: pwd
              }
              return utils.writeResponse(res, responseObj);
            })
        }
      })
  } catch (err) {
    logger.error("register_verify  catch  err", err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

function refreshTokenFunc(req, res) {
  try {
    const token = req.headers.authorization
    logger.info("refreshTokenFunc token", token);
    if (!token) {
      logger.warn("refreshTokenFunc no token");
      return utils.reportInvokeError(req, res, "token不能为空");
    }
    return utils.jwtVerify(token, res, async function (decoded) {
      const uuid = decoded.uuid;
      const responseObj = { token: {} };
      responseObj.token = utils.refreshToken(uuid);
      return utils.writeResponse(res, responseObj);
    })
  } catch (err) {
    logger.error("refreshTokenFunc err", err);
    return utils.reportError(req, res, err);
  }
}

async function resetPassword(req, res) {
  const token = req.headers.authorization
  const { oldPwd, newPwd } = req.body;
  try {
    if (!oldPwd || !newPwd || !token) {
      return utils.reportInvokeError(req, res, "原密码或新密码或token不能为空");
    }
    return utils.jwtVerify(token, res, async function (decoded) {
      const uuid = decoded.uuid;
      const result = await userMongoSink.find({ uuid });
      if (!result.length) {
        return utils.reportInvokeError(req, res, "用户名不存在");
      }
      const record = result[0];
      const dbPassword = record.password;
      const oldPassword = utils.encryptAES(oldPwd, record.salt);
      if (oldPassword !== dbPassword) {
        return utils.reportInvokeError(req, res, "原密码不正确");
      }
      if (!/^(?=(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*\d)|(?=.*[A-Z])(?=.*\d))[^]{6,16}$/.test(newPwd)) {
        return utils.reportInvokeError(req, res, "新密码必须包含大小写字母或数字中的两种且不低于6位数");
      }
      const salt = Buffer.from(utils.generateString(32), 'utf8').toString('hex');
      const password = utils.encryptAES(newPwd, salt);
      await userMongoSink.update({uuid}, { password, salt })
        .then(result => {
          logger.info("resetPassword userMongoSink update result.result", result.result);
          if (result.result.ok === 1 && result.result.nModified === 1) {
            const token = utils.refreshToken(uuid);
            const obj = Object.assign({}, { token, result: "reset_success" });
            logger.info("resetPassword success");
            return utils.writeResponse(res, obj);
          } else {
            logger.error('resetPassword token userMongoSink.update error, result', result);
            return utils.reportError(req, res, result);
          }
        })
    });
  } catch (err) {
    logger.error("resetPassword err", err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}

export default router;
