import { ParameterRules } from 'parameter';

export default {
  loginVerify: {
    username: 'string',
    pwd: 'string',
  } as ParameterRules<any>,
  registerVerify: {
    username: 'string',
  } as ParameterRules<any>,
  resetPassword: {
    oldPwd: 'string',
    newPwd: 'string',
  } as ParameterRules<any>,
};
