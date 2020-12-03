import * as mongodb from 'mongodb';
import CONF from '../config';
import logger from '../utils/logger'
import utils from "../utils/utils"

const MongoClient = mongodb.MongoClient; //加载数据库

function MongoSink() {
  MongoClient.connect(process.env.NODE_ENV === "production" ? CONF.MONGO : CONF.MONGO_DEBUG, { useNewUrlParser: true }, async (err, db) => {
    if (err) {
      logger.error("MongoClient.connect  err", err);
      throw err;
    }
    const self = this;
    const dbo = db.db(CONF.DATABASE);
    const model = dbo.collection(CONF.COLLECTION_INFOS);
    this.dataModel = { collections: model }
    return model.find({}, { projection: { _id: 0 } }).toArray(async function (err, result) {
      if (err) {
        logger.error("dbo.collection COLLECTION_INFOS find  err", err);
        throw err;
      } else {
        const arr = ['userInfo'];
        if (result.length) {
          if (!result.some(item => arr.includes(item.name))) {
            logger.error("dbo.collection COLLECTION_INFOS find unexpected collections, result", result);
            throw new Error('dbo.collection COLLECTION_INFOS find unexpected collections');
          }
          result.forEach(item => {
            self.dataModel[item.name] = dbo.collection(item.name);
          })
        } else {
          for (const item of arr) {
            // eslint-disable-next-line no-await-in-loop
            await self.dataModel.collections.insertOne({ name: item }, 'collections')
            // eslint-disable-next-line require-atomic-updates
            self.dataModel[item] = dbo.collection(item);
            if (item === 'userInfo') {
              // eslint-disable-next-line no-await-in-loop
              await self.dataModel[item].insertOne({
                "username": "charm",
                "password": "COD1PTL1AUMzYUd0ZONBkQ==",  //shuyun123
                "salt": "464276783771497845694c4f5043506f67384841597a6237337a484838416371",
                "uuid": "7fa1f092-ce74-490a-a902-7b583bc13b58"
              }, 'userInfo')
            }
          }
        }
        logger.info('mongodb服务启动成功')
      }
    });
  });
}

MongoSink.prototype.find = function (condition, projection, collectionName: string) {
  const checkResult = utils.checkDbCondition({ condition, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  if (!utils.checkDataType(projection, "Object")) {
    return Promise.reject(new Error("projection is not valid in mongo.find"));
  }
  return new Promise((res, rej) => {
    this.dataModel[collectionName].find(condition, { projection }).toArray(function (err, result) {
      if (err) {
        logger.error("dbo.collection  find  err", err);
        return rej(err);
      }
      res(result || []);
    });
  }).catch(err => {
    logger.error("MongoSink find err", err.stack || err.toString());
    return Promise.reject(err);
  });
};

MongoSink.prototype.findForPagination = function (condition, projection, sort, skip, limit, collectionName: string) {
  const checkResult = utils.checkDbCondition({ condition, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  if (!utils.checkDataType(projection, "Object") || !utils.checkDataType(sort, "Object")) {
    return Promise.reject(new Error("projection or sort is not valid in mongo.findForPagination"));
  }
  if (typeof skip !== 'number' || typeof limit !== 'number') {
    return Promise.reject(new Error("skip and limit is not valid"));
  }
  return new Promise((res, rej) => {
    this.dataModel[collectionName]
      .find(condition, { projection })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray(function (err, result) {
        if (err) {
          logger.error("dbo.collection find findForPagination  err", err);
          return rej(err);
        }
        res(result || []);
      });
  }).catch(err => {
    logger.error("MongoSink findForPagination err", err.stack || err.toString());
    return Promise.reject(err);
  });
};

MongoSink.prototype.insertOne = function (insertObj, collectionName: string) {
  const checkResult = utils.checkDbCondition({ condition: insertObj, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  return new Promise((res, rej) => {
    this.dataModel[collectionName].insertOne(insertObj, function (err, result) {
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

MongoSink.prototype.update = function (condition, object, upsert, collectionName) {
  const checkResult = utils.checkDbCondition({ condition, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  return new Promise(res => {
    this.dataModel[collectionName].updateOne(condition, { $set: object }, { upsert }, function (err, result) {
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

MongoSink.prototype.aggregate = function ({
  gtTime,
  ltTime,
  match,
  _id,
  group,
  sort,
  skip,
  limit,
  collectionName,
}) {
  if (
    !gtTime ||
    !ltTime ||
    !utils.checkDataType(match, "Object") ||
    !_id ||
    !utils.checkDataType(group, "Object") ||
    !sort ||
    !collectionName
  ) {
    return Promise.reject(new Error("param is not valid in aggregate"));
  } else {
    if (!skip) skip = 0;
    if (!limit) limit = 9999;
    return new Promise((res, rej) => {
      this.dataModel[collectionName]
        .aggregate([
          { $match: { date: { $gt: gtTime, $lte: ltTime }, ...match } },
          { $group: { _id, count: { $sum: 1 }, ...group } },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray(function (err, result) {
          if (err) {
            logger.error("aggregate err", err.stack || err.toString());
            rej(err);
          }
          return res(result);
        });
    }).catch((err) => {
      logger.error("mongo sink aggregate err", err.stack || err.toString());
      return Promise.reject(err);
    });
  }
};

MongoSink.prototype.aggregateForPagination = function ({
  gtTime,
  ltTime,
  match,
  _id,
  group,
  collectionName,
}) {
  if (
    !gtTime ||
    !ltTime ||
    !utils.checkDataType(match, "Object") ||
    !_id ||
    !utils.checkDataType(group, "Object") ||
    !collectionName
  ) {
    return Promise.reject(new Error("param is not valid in aggregateForPagination"));
  } else {
    return new Promise((res, rej) => {
      this.dataModel[collectionName]
        .aggregate([
          { $match: { date: { $gt: gtTime, $lte: ltTime }, ...match } },
          { $group: { _id, count: { $sum: 1 }, ...group } },
          { $group: { _id: null, total: { $sum: 1 } } },
        ])
        .toArray(function (err, result) {
          if (err) {
            logger.error("aggregateForPagination err", err.stack || err.toString());
            rej(err);
          }
          return res(result);
        });
    }).catch((err) => {
      logger.error("mongo sink aggregateForPagination err", err.stack || err.toString());
      return Promise.reject(err);
    });
  }
};

MongoSink.prototype.distinctForUUID = function ({ gtTime, ltTime, type, query, collectionName }) {
  if (
    !gtTime
    || !ltTime
    || !type
    || !utils.checkDataType(query, 'Object')
    || !collectionName
  ) {
    return Promise.reject(new Error('param is not valid in distinctForUUID'))
  } else {
    return new Promise((res, rej) => {
      this.dataModel[collectionName].distinct("uuid", { date: { $gt: gtTime, $lte: ltTime }, type, ...query }, function (err, result) {
        if (err) {
          logger.error("mongo distinctForUUID err", err.stack || err.toString());
          rej(err);
        }
        return res(result);
      })
    })
      .catch(err => {
        logger.error("mongo sink distinctForUUID err", err.stack || err.toString());
        return Promise.reject(err);
      });
  }
}

MongoSink.prototype.count = function (condition, collectionName: string) {
  const checkResult = utils.checkDbCondition({ condition, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  return new Promise((res, rej) => {
    this.dataModel[collectionName].find(condition).count(function (err, result) {
      if (err) {
        logger.error("dbo.collection count err", err);
        return rej(err);
      }
      res(result);
    });
  }).catch(err => {
    logger.error("MongoSink count err", err.stack || err.toString());
    return Promise.reject(err);
  });
}

MongoSink.prototype.remove = function (condition, options, collectionName: string) {
  const checkResult = utils.checkDbCondition({ condition, collectionName });
  if (checkResult) {
    return Promise.reject(checkResult)
  }
  if (!utils.checkDataType(options, "Object")) {
    return Promise.reject(new Error('options must be an object'))
  }
  return new Promise((res, rej) => {
    this.dataModel[collectionName].remove(condition, options, function (err, result) {
      if (err) {
        logger.error("dbo.collection remove err", err);
        return rej(err);
      }
      res(result);
    });
  }).catch(err => {
    logger.error("MongoSink count err", err.stack || err.toString());
    return Promise.reject(err);
  });
}

export default new MongoSink()
