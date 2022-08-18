//const { request } = require('undici');
const https = require('https');
const server = https.createServer();
const PORT = process.env.PORT || 3000;

const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const StateHandler = require('./src/state');

const {
  readFile,
  addToState,
  addRequestedSongNameToCache,
  removeRequestedSongNameFromCache,
  checkRequestedSongNameInCache,
  getRandomLyrics,
  startQuiz,
  writeFile,
  getValidQuizAnswersNumber,
} = require('./src/helpers');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { API_TOKEN } = process.env;

const init = async () => {
  //const state = await new StateHandler('./db/storage.json').init();

  const bot = new TelegramBot(API_TOKEN, { polling: true });

  const queryCallbacks = {
    rem: async (payload, songTextId) => {
      try {
        const {
          message: {
            message_id,
            chat: { id },
          },
        } = payload;

        const chatId = id;
        const songNameId = message_id;

        await bot.deleteMessage(chatId, songTextId);
        await bot.deleteMessage(chatId, songNameId);
        await removeRequestedSongNameFromCache(songTextId);

        if (payload.originCaller !== songTextId) {
          // ? only for bot that is admin in group
          await bot.deleteMessage(chatId, payload.originCaller);
        }
      } catch (e) {
        console.log('remove messages callback_query');
      }
    },
    song: async (payload, id) => {
      if (await checkRequestedSongNameInCache(payload.message.message_id)) {
        return;
      }

      try {
        const chatId = payload.message.chat.id;

        const file = await readFile('./db/storage.json');

        [songName, album] = file['song'][id];

        await bot.sendMessage(chatId, songName, {
          reply_to_message_id: payload.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Удалить сообщения с этой песней',
                  callback_data: `rem ${payload.message.message_id} ${payload.originCaller}`,
                },
              ],
            ],
          },
        });

        //delete file['song'][id];

        //await writeFile('./db/storage.json', JSON.stringify(file));

        await addRequestedSongNameToCache(payload.message.message_id);
        console.log('callback_query');
      } catch (e) {
        console.log('song callback_query error');
      }
    },
    anek: async (payload) => {
      if (await checkRequestedSongNameInCache(payload.message.message_id)) {
        return;
      }

      try {
        const chatId = payload.message.chat.id;

        await bot.sendPhoto(chatId, './src/assets/images/anek_1.PNG', {
          reply_to_message_id: payload.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Удалить анекдот',
                  callback_data: `rem ${payload.message.message_id} ${payload.originCaller}`,
                },
              ],
            ],
          },
        });

        await addRequestedSongNameToCache(payload.message.message_id);
        console.log('callback_query');
      } catch (e) {
        console.log('anek callback_query error');
      }
    },
    quiz: async (payload, ...data) => {
      const {
        from: { first_name },
        message: {
          message_id,
          chat: { id },
        },
      } = payload;

      const callerId = payload.from.id;

      const cachedId = message_id + callerId;

      const identifier = data[1];

      if (
        (await checkRequestedSongNameInCache(cachedId)) &&
        identifier !== '-1'
      ) {
        bot.answerCallbackQuery(payload.id, {
          text: `${first_name}, гусяра, ты уже голосовал`,
        });
        return;
      }

      try {
        const storage = await readFile('./db/storage.json');

        const quizId = data[0];

        const quiz = storage.quiz[quizId];

        if ((!quiz && identifier !== '-1') || (!quiz && identifier === '-1')) {
          throw new Error('');
        }

        if (identifier === '-1') {
          delete storage.quiz[quizId];

          await writeFile('./db/storage.json', JSON.stringify(storage));

          await removeRequestedSongNameFromCache(cachedId);

          if (!quiz.repliers.length) {
            await bot.sendMessage(
              id,
              `Никто правильно не ответил. Правильный ответ:\n<b>${quiz.songName}</b>`,
              {
                reply_to_message_id: message_id,
                parse_mode: 'HTML',
              },
            );

            return;
          }

          const winner =
            quiz?.repliers.filter((el) => el.isCorrect === true) || [];

          const losers =
            quiz?.repliers.filter((el) => el.isCorrect !== true) || [];

          const resultMessage =
            winner.length && winner.length < 2
              ? `${winner[0].replierName} дохуя умный.`
              : winner.length
              ? `${winner.reduce(
                  (ac, { replierName }) => (ac += `${replierName}, `),
                  '',
                )}что-то знают`
              : 'Никто правильно не ответил';

          const losersMessage = losers.length
            ? `\n${losers.reduce(
                (ac, { replierName }) => (ac += `${replierName}, `),
                '',
              )}это же база!`
            : '';

          await bot.sendMessage(
            id,
            `${resultMessage}\nПравильный ответ: ${quiz.songName}\n${losersMessage}`,
            {
              reply_to_message_id: message_id,
            },
          );

          return;
        }

        storage.quiz[quizId].repliers.push({
          replierName: first_name,
          isCorrect: quiz.answers[Number(identifier)].isTrue,
        });

        bot.answerCallbackQuery(payload.id, {
          text: `${first_name}, голос засчитан`,
        });

        await writeFile('./db/storage.json', JSON.stringify(storage));
        await addRequestedSongNameToCache(cachedId);
      } catch (e) {
        console.log('quiz callback_query');

        bot.answerCallbackQuery(payload.id, { text: 'Опрос закрыт' });
      }
    },
  };

  bot.on('callback_query', async (payload) => {
    //console.log('payload: ', payload.from.first_name);

    const [type, ...data] = payload.data.split(' ');

    payload.originCaller = data.at(-1);

    await queryCallbacks[type]?.(payload, ...data);
  });

  bot.onText(
    /^\/quiz(@Gorshok_is_alive_Bot)?(\s{1,}\d{1,})?/,
    async (msg, [, , dig]) => {
      // ? for bot chat only
      //bot.onText(/^\/quiz$/, async (msg, [, match]) => {
      const chatId = msg.chat.id;
      try {
        const callerMessageId = msg.message_id;

        const id = crypto.randomBytes(19).toString('hex');

        const numberOfAnswers = getValidQuizAnswersNumber(dig);

        const { songName, songText, answers, repliers } = await startQuiz(
          numberOfAnswers,
        );

        await addToState({
          type: 'quiz',
          id,
          data: { songName, songText, answers, repliers },
        });

        const songAnswerKeys = answers.map((item, index) => {
          return [
            {
              text: `Вариант №${index + 1}: ${item.name}`,
              callback_data: `quiz ${id} ${index}`,
            },
          ];
        });

        await bot.sendMessage(
          chatId,
          `СТАРТУЕМ:\n
      <b>${songText}</b>
      `,
          {
            reply_to_message_id: callerMessageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                ...songAnswerKeys,
                [
                  {
                    text: 'Итог',
                    callback_data: `quiz ${id} -1`,
                  },
                ],
              ],
              remove_keyboard: true,
            },
          },
        );
      } catch (e) {
        console.log('quiz error', e);
        bot.sendMessage(
          chatId,
          'У ботов тоже есть право на отдых. Я сейчас воспользуюсь этим правом',
        );
      }
    },
  );

  bot.onText(/^\/random(@Gorshok_is_alive_Bot)?$/, async (msg, [, match]) => {
    //? for bot chat only
    //bot.onText(/^\/random$/, (msg, [, match]) => {
    const chatId = msg.chat.id;
    try {
      const { name, text, album } = getRandomLyrics();

      const callerMessageId = msg.message_id;

      const id = crypto.randomBytes(19).toString('hex');

      await addToState({
        type: 'song',
        id,
        data: [name, album],
      });

      await bot.sendMessage(chatId, text, {
        reply_to_message_id: callerMessageId,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Название песни',
                callback_data: `song ${id} ${callerMessageId}`,
              },
            ],
          ],
        },
      });
    } catch (e) {
      console.log('random song error');
      bot.sendMessage(
        chatId,
        'У ботов тоже есть право на отдых. Я сейчас воспользуюсь этим правом',
      );
    }
  });

  bot.onText(/^\/anekdot(@Gorshok_is_alive_Bot)?$/, async (msg, [, match]) => {
    // ? for bot chat only
    //bot.onText(/^\/anekdot$/, async (msg, [, match]) => {
    const chatId = msg.chat.id;
    try {
      const callerMessageId = msg.message_id;

      await bot.sendPhoto(chatId, './src/assets/images/anek_1.PNG', {
        reply_to_message_id: callerMessageId,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Удалить анекдот',
                callback_data: `rem ${callerMessageId}`,
              },
            ],
          ],
        },
      });
    } catch (e) {
      console.log('anekdot error');
      bot.sendMessage(
        chatId,
        'У ботов тоже есть право на отдых. Я сейчас воспользуюсь этим правом',
      );
    }
  });

  bot.on('polling_error', (error) => {
    console.log('polling_error', error.code);

    bot.startPolling({ restart: true });
  });
};

server.listen(PORT, async () => {
  await init();
  console.log(`The app listening on port ${PORT}`);
});

setInterval(() => {
  https.get(process.env.APP_LINK);
}, 180000);

/*
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
