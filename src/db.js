const { MongoClient } = require('mongodb');

class DatabaseHandler extends MongoClient {
  constructor(uri, dbName = 'bot_db') {
    super(uri);

    this.database = null;

    this.dbName = dbName;

    this.stream = null;
  }

  async init() {
    try {
      super.on('connectionCreated', (connection) => {
        console.log('mongo connected');
      });

      super.on('connectionClosed', () => {
        console.log('db close event');
      });

      this.stream = await super.connect();

      this.database = this.stream.db(this.dbName);

      return this;
    } catch (e) {
      console.log('init db error', e);
    }
  }

  async getMarkup(id) {
    try {
      const record = await this.stream.database
        .collection('markups')
        .findOne({ id });

      return record;
    } catch (e) {
      console.log('get markup from db error', e);
      throw new Error('from get markup from db error');
    }
  }

  async addToState(props) {
    const { type, ...res } = props;

    try {
      const collection = this.stream.database.collection(type);

      const { insertedId } = await collection.insertOne(res);

      const record = await collection.findOne({ _id: insertedId });

      return record;
    } catch (e) {
      console.log('add to state', e);
      throw new Error('from add to state');
    }
  }

  async getRandomSong(cb) {
    try {
      const cursor = this.stream.database
        .collection('lyrics')
        .aggregate([{ $sample: { size: 1 } }]);

      const recordArr = await cursor.toArray();

      if (typeof cb === 'function') {
        cb(recordArr);
      }

      return recordArr[0];
    } catch (e) {
      console.log('get random from db error', e);
      throw new Error('from get random from db error');
    }
  }

  getCachedMessages() {
    return this.database.collection('calledMessageCache');
  }

  async getState(...states) {
    try {
      const collections = {};
      for (let i = 0; i < states.length; i++) {
        const state = states[i];
        const rawData = await this.stream.database
          .collection(state)
          .find()
          .toArray();

        const data = rawData.reduce((accum, { id, ...res }) => {
          accum[id] = {
            ...res,
            id,
          };
          return accum;
        }, {});

        collections[state] = data;
      }
      return collections;
    } catch (e) {
      console.log('get state', e);
      throw new Error('from get state');
    }
  }

  async remove(id, type = 'song') {
    try {
      const collection = this.stream.database.collection(type);

      const result = await collection.deleteOne({ id });

      return result;
    } catch (e) {
      console.log('remove record', e);
      throw new Error('from remove record');
    }
  }

  async pushElement(type, id, prop, element) {
    try {
      const collection = this.stream.database.collection(type);

      const result = await collection.updateOne(
        { id },
        { $push: { [`data.${prop}`]: element } },
      );

      return result;
    } catch (e) {
      console.log('push to record', e);
      throw new Error('from push to record');
    }
  }

  async getVotedNumber(id) {
    try {
      const record = await this.stream.database
        .collection('quiz')
        .findOne({ id });

      return record.data.repliers.length;
    } catch (e) {
      console.log('get voted number', e);
      throw new Error('from get voted number');
    }
  }
}

module.exports = DatabaseHandler;
