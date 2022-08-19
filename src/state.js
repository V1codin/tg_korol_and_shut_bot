const DEFAULT_STORE = {
  song: {},
  quiz: {},
  calledMessageCache: {},
  markups: {},
};

class StateHandler {
  #state;

  constructor(initial = DEFAULT_STORE) {
    this.#state = initial;
  }

  addToState(record) {
    try {
      const { type, ...res } = record;

      this.#state[type][res.id] = {
        ...res,
      };
    } catch (e) {
      console.log('add to local state error', e);
    }
  }

  pushToElement(type, id, prop, element) {
    if (Array.isArray(this.getLocalState()?.[type]?.[id]?.data?.[prop])) {
      this.#state[type][id]?.data?.[prop].push(element);
    }
  }

  getCalledMessageCache(id) {
    if (id) {
      return this.getLocalState()['calledMessageCache'][id];
    }
    return this.getLocalState()['calledMessageCache'];
  }

  checkInCache(prop) {
    return String(prop) in this.getCalledMessageCache();
  }

  addRequestedSongNameToCache(prop, data = true) {
    if (this.checkInCache(prop)) {
      this.getLocalState()['calledMessageCache'][prop] = {
        ...this.getLocalState()['calledMessageCache'][prop],
        ...data,
      };
      return;
    }
    this.getLocalState()['calledMessageCache'][prop] = data;
  }

  getLocalState(prop) {
    if (prop) {
      return this.#state[prop];
    }
    return this.#state;
  }

  remove(id, type = 'song') {
    delete this.#state[type][id];
  }

  removeMany(id, type = 'song') {
    const keys = Object.keys(this.#state[type]);

    keys.forEach((key) => {
      if (id.test(key)) {
        delete this.#state[type][key];
      }
    });
  }
}

module.exports = StateHandler;
