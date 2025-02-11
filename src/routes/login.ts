import * as express from 'express';
import utils from '../utils/utils';

export async function loginVerify(req: express.Request, res: express.Response) {
  try {
    const { username, pwd } = req.body;
    console.info('login_verify username pwd', username, pwd);
    //put yor code here
    return utils.writeResponse(req, res, { data: 'put yor code here' });
  } catch (err: any) {
    console.error('loginVerify err', err.stack || err.toString());
    return utils.reportError(req, res, err);
  }
}
