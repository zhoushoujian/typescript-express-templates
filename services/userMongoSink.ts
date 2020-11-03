import * as mongodb from 'mongodb';
import CONF from '../config';
import logger from '../utils/logger'

const MongoClient = mongodb.MongoClient; //加载数据库

function MongoSink(props) {
  MongoClient.connect(CONF.MONGO, { useNewUrlParser: true }, async (err, db) => {
    if (err) {
      logger.error("MongoClient.connect  err", err);
      throw err;
    }
    const dbo = db.db(props.DATABASE);
    this._model = dbo.collection(props.COLLECTION_USER);
  });
}

MongoSink.prototype.find = function (condition, projection = {}) {
  if (Object.prototype.toString.call(condition) !== '[object Object]') {
    return Promise.reject(new Error("no_condition"));
  }
  return new Promise((res, rej) => {
    this._model.find(condition, projection).toArray(function (err, result) {
      if (err) {
        logger.error("dbo.collection  find  err", err);
        // eslint-disable-next-line prefer-promise-reject-errors
        return rej([err]);
      }
      res(result || []);
    });
  }).catch(err => {
    logger.error("MongoSink find err", err.stack || err.toString());
    return Promise.reject(err);
  });
};

MongoSink.prototype.insertOne = function (insertObj) {
  if (Object.prototype.toString.call(insertObj) !== '[object Object]') {
    return Promise.reject(new Error("invalid_insertStrObj"));
  }
  return new Promise((res, rej) => {
    this._model.insertOne(insertObj, function (err, result) {
      if (err) {
        logger.error("insertOne  err", err);
        return rej(err);
      }
      res(result);
    });
  }).catch(err => {
    logger.error("MongoSink insertOne err", err.stack || err.toString());
    return Promise.reject(err);
  });
};

MongoSink.prototype.update = function (condition, object = {}, upsert = true) {
  if (Object.prototype.toString.call(condition) !== '[object Object]') {
    return Promise.resolve(new Error("invalid_condition"));
  }
  return new Promise(res => {
    this._model.updateOne(condition, { $set: object }, { upsert }, function (err, result) {
      if (err) {
        logger.error("update updateOne err", err.stack || err.toString());
        throw err;
      }
      return res(result);
    });
  })
    .catch(err => {
      logger.error("mongo sink update err", err.stack || err.toString());
      return Promise.reject(err);
    });
};

const userMongoSink = new MongoSink({
  DATABASE: CONF.DATABASE,
  COLLECTION_USER: CONF.COLLECTION_USER
});

export default userMongoSink
