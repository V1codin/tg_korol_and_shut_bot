const { request } = require('undici');
const express = require('express');

const DatabaseHandler = require('./src/db');

const TelegramBot = require('node-telegram-bot-api');

const StateHandler = require('./src/state');

const {
  getRandomSongCommand,
  getAnekCommand,
  getQuizCommand,
} = require('./src/routes/bot_commands');

const { getQueryCommands } = require('./src/helpers');

const app = express();

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { API_TOKEN, MONGO_USER, MONGO_PW, DB_NAME } = process.env;

const mongo_uri = `mongodb+srv://${MONGO_USER}:${MONGO_PW}@cluster.kw9an2x.mongodb.net/?retryWrites=true&w=majority`;

app.get('/', function (req, res) {
  res.send('is alive');
});

const init = async () => {
  try {
    const bot = new TelegramBot(API_TOKEN, { polling: true });

    const db = await new DatabaseHandler(mongo_uri, DB_NAME).init();

    const states = await db.getState('song', 'quiz', 'calledMessageCache');

    const state = new StateHandler(states);

    const queryCallbacks = getQueryCommands(bot, state, db);

    bot.on('callback_query', async (payload) => {
      //console.log('payload: ', payload.from.first_name);

      const [type, ...data] = payload.data.split(' ');

      await queryCallbacks[type]?.(payload, ...data);
    });

    bot.onText(...getQuizCommand(bot, db, state));

    bot.onText(...getRandomSongCommand(bot, db, state));

    bot.onText(...getAnekCommand(bot, db, state));

    bot.on('polling_error', (error) => {
      console.log('polling_error', error.code);

      bot.startPolling({ restart: true });
    });
  } catch (e) {
    console.log('init error', e);
  }
};

app.listen(PORT, async () => {
  await init();
  console.log(`The app listening on port ${PORT}`);
});

/*
setInterval(async () => {
  await request(process.env.APP_LINK);
}, 300000);


bot.on('inline_query', () => {
  console.log('inline_query');
});

bot.on('poll', () => {
  console.log('poll');
});

bot.on('shipping_query', () => {
  console.log('shipping_query');
});

bot.on('channel_post', () => {
  console.log('channel_post');
});
*/
