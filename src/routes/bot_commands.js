const crypto = require('crypto');

const {
  getQueryActions,
  readFile,
  addToState,
  addRequestedSongNameToCache,
  removeRequestedSongNameFromCache,
  checkRequestedSongNameInCache,
  getRandomLyrics,
  startQuiz,
  writeFile,
  getValidQuizAnswersNumber,
} = require('../helpers');

const getRandomSongCommand = (bot, dbHandler) => {
  return [
    /^\/random(@Gorshok_is_alive_Bot)?$/,
    async (msg, [, match]) => {
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
    },
  ];
};
