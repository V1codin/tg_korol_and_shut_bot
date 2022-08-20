const crypto = require('crypto');

const {
  getDate,
  getValidQuizAnswersNumber,
  getRandomLyrics,
  startQuiz,
  getQuizMessage,
} = require('../helpers');

const getRandomSongCommand = (bot, dbHandler, localState) => {
  return [
    /^\/random(@Gorshok_is_alive_Bot)?$/,
    async (msg, [, match]) => {
      //? for bot chat only
      //bot.onText(/^\/random$/, (msg, [, match]) => {
      const chatId = msg.chat.id;
      try {
        const song = await dbHandler.getRandomSong();

        const { name, text, album } = getRandomLyrics(song);

        const callerMessageId = msg.message_id;
        const id = crypto.randomBytes(19).toString('hex');
        const type = 'song';

        const record = await dbHandler.addToState({
          type,
          id,
          data: [name, album],
          time: getDate(),
        });

        localState.addToState({
          type,
          ...record,
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
        console.log('random song error', e);
        await bot.sendMessage(
          chatId,
          'У ботов тоже есть право на отдых. Я сейчас воспользуюсь этим правом',
        );
      }
    },
  ];
};

const getAnekCommand = (bot) => {
  return [
    /^\/anekdot(@Gorshok_is_alive_Bot)?$/,
    async (msg, [, match]) => {
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
    },
  ];
};

const getQuizCommand = (bot, dbHandler, localState) => {
  return [
    /^\/quiz(@Gorshok_is_alive_Bot)?(\s{1,}\d{1,})?/,
    async (msg, [, , dig]) => {
      // ? for bot chat only
      //bot.onText(/^\/quiz$/, async (msg, [, match]) => {
      const chatId = msg.chat.id;
      try {
        const callerMessageId = msg.message_id;
        const id = crypto.randomBytes(19).toString('hex');
        const numberOfAnswers = getValidQuizAnswersNumber(dig);

        const songRecord = await dbHandler.getRandomSong();

        const song = getRandomLyrics(songRecord);

        const { songName, songText, answers, repliers, nextLine } = startQuiz(
          song,
          numberOfAnswers,
        );

        const type = 'quiz';

        const quizRecord = await dbHandler.addToState({
          type,
          id,
          data: { songName, songText, answers, repliers, nextLine },
        });

        localState.addToState({
          type,
          ...quizRecord,
        });

        const songAnswerKeys = answers.map((item, index) => {
          return [
            {
              text: `Вариант №${index + 1}: ${item.name}`,
              callback_data: `quiz ${id} ${index}`,
            },
          ];
        });
        const markup = {
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
        };

        const addToDb = {
          type: 'markups',
          markup,
          text: getQuizMessage({ songText, nextLine }),
          songText,
          id,
        };

        const addedMarkup = await dbHandler.addToState(addToDb);

        localState.addToState({
          type: 'markups',
          addedMarkup,
        });

        await bot.sendMessage(chatId, addToDb.text, markup);
      } catch (e) {
        console.log('quiz error', e);
        bot.sendMessage(
          chatId,
          'У ботов тоже есть право на отдых. Я сейчас воспользуюсь этим правом',
        );
      }
    },
  ];
};

module.exports = {
  getRandomSongCommand,
  getAnekCommand,
  getQuizCommand,
};
