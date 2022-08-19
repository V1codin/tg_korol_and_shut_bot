class DatabaseHandler {
  constructor(client, dbName = 'bot_db') {
    this.client = client;
    this.database = null;

    this.dbName = dbName;

    this.init();
  }
  init() {
    try {
      this.database = this.client.db(this.dbName);
    } catch (e) {
      console.log('init db error', e);
    } finally {
      this.client.close();
    }
  }

  getCachedMessages() {
    return this.database.collection('calledMessageCache');
  }
}

module.exports = DatabaseHandler;
