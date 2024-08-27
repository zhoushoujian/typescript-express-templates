import * as express from 'express';
import * as Parameter from 'parameter';
import logger from './logger';
import utils from './utils';

export const validParam = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  rules: Parameter.ParameterRules,
) => {
  try {
    const parameter = new Parameter();

    if (!rules) {
      return utils.reportError(req, res, new Error('rules cannot be undefined'));
    }

    const params = ['GET', 'HEAD', 'DELETE'].includes(req.method.toUpperCase()) ? req.query : req.body;
    const errors: Parameter.ValidateError[] | void = parameter.validate(rules, params);
    if (errors && errors.length) {
      logger.info('validParam errors', errors);
      return utils.reportInvokeError(req, res, errors.map((item) => `${item.field}: ${item.message};`).join('\r\n'));
    } else {
      return next();
    }
  } catch (err) {
    logger.error('validParam err', err);
    return utils.reportError(req, res, err);
  }
};
