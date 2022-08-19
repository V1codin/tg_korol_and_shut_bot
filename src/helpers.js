const lyrics = require('../db/songNames.json');

const MAX_QUIZ_ANSWERS = 25;
const MIN_QUIZ_ANSWERS = 2;
const DEFAULT_QUIZ_ANSWERS = 4;

const shuffle = (array) => {
  let currentIndex = array.length,
    randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
};

const getRandom = (max = 1, min = 0) =>
  Math.floor(Math.random() * (max - min)) + min;

const getRandomLyrics = (song) => {
  const randomTextValue = getRandom(song.lyrics.length);
  //console.log('song.lyrics.length: ', song.lyrics.length);
  //console.log('randomTextValue: ', randomTextValue);
  const result = song.lyrics[randomTextValue];

  if (!result) {
    return getRandomLyrics(song);
  }

  return {
    name: song.name,
    text: result,
    album: song.albumName,
    fullLyrics: song.lyrics,
    textIndex: randomTextValue,
  };
};

const getValidQuizAnswersNumber = (str) => {
  const number = parseInt(str);

  if (
    Number.isNaN(number) ||
    number < MIN_QUIZ_ANSWERS ||
    number > MAX_QUIZ_ANSWERS
  ) {
    return DEFAULT_QUIZ_ANSWERS;
  }

  return number;
};

const startQuiz = (song, answerNumbers = DEFAULT_QUIZ_ANSWERS) => {
  const answers = [
    {
      name: song.name,
      isTrue: true,
    },
  ];

  while (answers.length !== answerNumbers) {
    const randIndex = getRandom(lyrics.names.length);
    const randomSong = lyrics.names[randIndex];

    if (answers.find((element) => element.name === randomSong)) {
      continue;
    }

    answers.push({
      name: randomSong,
      isTrue: false,
    });
  }

  return {
    songName: song.name,
    songText: song.text,
    answers: shuffle(answers),
    repliers: [],
  };
};

const getQueryCommands = (bot, localStorage, db) => {
  return {
    remsong: async (payload, actionId) => {
      try {
        const {
          message: {
            message_id,
            chat: { id },
          },
        } = payload;

        const chatId = id;
        const songNameId = message_id;

        const recordToRemove = localStorage.getCalledMessageCache();

        await bot.deleteMessage(chatId, actionId);
        await bot.deleteMessage(chatId, songNameId);

        if (recordToRemove[actionId].callerId !== actionId) {
          // ? only for bot that is admin in group
          await bot.deleteMessage(chatId, recordToRemove[actionId].callerId);
        }

        const removedCache = await db.remove(
          Number(actionId),
          'calledMessageCache',
        );

        if (removedCache.deletedCount) {
          localStorage.remove(actionId, 'calledMessageCache');
        }
      } catch (e) {
        console.log('remove song callback_query', e);
        throw new Error('remove song callback_query');
      }
    },
    rem: async (payload, messageId) => {
      try {
        const {
          message: {
            message_id,
            chat: { id },
          },
        } = payload;

        const chatId = id;
        const songNameId = message_id;

        await bot.deleteMessage(chatId, songNameId);
        await bot.deleteMessage(chatId, messageId);
      } catch (e) {
        console.log('remove messages callback_query');
      }
    },
    song: async (payload, id, callerId) => {
      if (localStorage.checkInCache(payload.message.message_id)) {
        await bot.answerCallbackQuery(payload.id, {
          text: `${payload.from.first_name}, это ты уже жмякал`,
        });
        console.log('there is in cache! (song)');
        return;
      }

      try {
        const chatId = payload.message.chat.id;

        const file = localStorage.getLocalState();

        [songName, album] = file['song'][id].data;

        await bot.sendMessage(chatId, songName, {
          reply_to_message_id: payload.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Удалить сообщения с этой песней',
                  callback_data: `remsong ${payload.message.message_id}`,
                },
              ],
            ],
          },
        });

        const isRemoved = await db.remove(id);
        if (isRemoved.deletedCount) {
          localStorage.remove(id);

          const cachedData = {
            type: 'calledMessageCache',
            id: payload.message.message_id,
            callerId,
          };

          const record = await db.addToState(cachedData);

          localStorage.addRequestedSongNameToCache(
            payload.message.message_id,
            record,
          );
        }

        console.log('callback_query');
      } catch (e) {
        console.log('song callback_query error', e);
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

      if (localStorage.checkInCache(cachedId) && identifier !== '-1') {
        await bot.answerCallbackQuery(payload.id, {
          text: `${first_name}, гусяра, ты уже голосовал`,
        });
        return;
      }

      try {
        const storage = localStorage.getLocalState('quiz');

        const quizId = data[0];

        const quiz = storage[quizId]?.data;

        if ((!quiz && identifier !== '-1') || (!quiz && identifier === '-1')) {
          throw new Error('');
        }

        if (identifier === '-1') {
          const removedCache = await db.remove(quizId, 'quiz');
          const removedMarkup = await db.remove(quizId, 'markups');

          if (removedCache.deletedCount && removedMarkup.deletedCount) {
            localStorage.remove(quizId, 'quiz');
            localStorage.remove(quizId, 'markups');

            const record = await db.remove(cachedId, 'calledMessageCache');

            if (record.deletedCount) {
              localStorage.remove(cachedId, 'calledMessageCache');
            }
          }

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

        const toPush = [
          'quiz',
          quizId,
          'repliers',
          {
            replierName: first_name,
            isCorrect: quiz.answers[Number(identifier)].isTrue,
          },
        ];

        const updated = await db.pushElement(...toPush);

        if (updated.modifiedCount) {
          localStorage.pushToElement(...toPush);
        }

        const markupRecord = await db.getMarkup(quizId);
        const voted = await db.getVotedNumber(quizId);

        const newText = getQuizMessage(markupRecord.songText, voted);

        await bot.editMessageText(newText, {
          chat_id: id,
          message_id,
          ...markupRecord.markup,
        });

        await bot.answerCallbackQuery(payload.id, {
          text: `${first_name}, голос засчитан`,
        });

        const cachedData = {
          type: 'calledMessageCache',
          id: cachedId,
        };

        const record = await db.addToState(cachedData);

        localStorage.addRequestedSongNameToCache(cachedId, record);
      } catch (e) {
        console.log('quiz callback_query error');

        await bot.answerCallbackQuery(payload.id, { text: 'Опрос закрыт' });
      }
    },
    edit: async (payload) => {
      console.log('payload: ', payload);
      const {
        message: {
          message_id,
          chat: { id },
        },
      } = payload;

      await bot.editMessageText('allo', {
        chat_id: id,
        message_id,
      });
    },
  };
};

const getDate = () => {
  const tzoffset = new Date().getTimezoneOffset() * 60000;
  const localISOTime = new Date(Date.now() - tzoffset)
    .toISOString()
    .slice(0, -1);

  return localISOTime;
};

const getQuizMessage = (songName, voted = 0) => {
  return `СТАРТУЕМ:\n
  <b>${songName}</b>
  
  Проголосовал${voted > 1 || voted === 0 ? 'о' : ''}: <i>${voted}</i> ${
    voted > 1 || voted === 0 ? 'человечков' : 'человечек'
  }
  `;
};

module.exports = {
  getDate,
  getQueryCommands,
  getRandomLyrics,
  startQuiz,
  getValidQuizAnswersNumber,
  getQuizMessage,
};

/*

function string2Bin(str) {
  var result = [];
  for (var i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i).toString(2));
  }
  return result;
}

function bin2String(array) {
  var result = '';
  for (var i = 0; i < array.length; i++) {
    result += String.fromCharCode(parseInt(array[i], 2));
  }
  return result;
}
*/
