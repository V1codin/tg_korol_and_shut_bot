const fsPromise = require('fs/promises');

const DEFAULT_STORE = { song: {}, quiz: {} };

class StateHandler {
  constructor(filePath) {
    this.outerFilePath = filePath;

    this.state = null;
  }

  addToState(props) {
    const { type, id, data } = props;

    const file = this.getLocalState();

    file[type][id] = data;

    //await writeFile('./db/storage.json', JSON.stringify(file));
  }

  async init() {
    this.state = await this.readState(this.outerFilePath);

    return this.getLocalState();
  }

  async readState(path, cb) {
    try {
      const rowData = await fsPromise.readFile(path);

      const data = await JSON.parse(rowData);

      if (typeof cb === 'function') {
        await cb(data);
      }

      return data;
    } catch (e) {
      console.log('read file error', e);

      return DEFAULT_STORE;
    }
  }

  getLocalState() {
    return this.state;
  }

  async updateOuterState() {}
}

module.exports = StateHandler;
