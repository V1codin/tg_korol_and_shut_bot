const fsPromise = require('fs/promises');

const lyrics = require('../db/Lyrics.json');

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

const readFile = async (path) => {
  try {
    const rowData = await fsPromise.readFile(path);

    const data = await JSON.parse(rowData);

    return data;
  } catch (e) {
    console.log('read file error', e);
  }
};

const writeFile = (path, data) => {
  return fsPromise.writeFile(path, data);
};

const addToState = async (props) => {
  const { type, id, data } = props;

  const file = await readFile('./db/storage.json');

  file[type][id] = data;

  return await writeFile('./db/storage.json', JSON.stringify(file));
};

const addRequestedSongNameToCache = async (prop) => {
  try {
    const data = await readFile('./db/calledMessageCache.json');

    data[prop] = true;

    await writeFile('./db/calledMessageCache.json', JSON.stringify(data));
  } catch (e) {
    console.log('add song text id to cache', e);
  }
};

const removeRequestedSongNameFromCache = async (id) => {
  if (!id) {
    return;
  }

  try {
    const data = await readFile('./db/calledMessageCache.json');

    delete data[id];

    await writeFile('./db/calledMessageCache.json', JSON.stringify(data));
  } catch (e) {
    console.log('remove from cache song text id error', e);
  }
};

const checkRequestedSongNameInCache = async (prop) => {
  const data = await readFile('./db/calledMessageCache.json');

  return String(prop) in data;
};

const getRandom = (max = 1, min = 0) =>
  Math.floor(Math.random() * (max - min)) + min;

const getRandomLyrics = (db = lyrics) => {
  const songs = db.allSongs;

  const randomSongValue = getRandom(songs.length);
  //console.log('randomSongValue: ', randomSongValue)
  const song = songs[randomSongValue];

  //console.log('===================================');
  const randomTextValue = getRandom(song.lyrics.length);
  //console.log('song.lyrics.length: ', song.lyrics.length);
  //console.log('randomTextValue: ', randomTextValue);
  const result = song.lyrics[randomTextValue];

  if (!result) {
    return getRandomLyrics(db);
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

const startQuiz = async (answerNumbers = DEFAULT_QUIZ_ANSWERS) => {
  const song = await getRandomLyrics();

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

module.exports = {
  readFile,
  writeFile,
  addToState,
  addRequestedSongNameToCache,
  removeRequestedSongNameFromCache,
  checkRequestedSongNameInCache,
  getRandom,
  getRandomLyrics,
  startQuiz,
  getValidQuizAnswersNumber,
};

/*

? dep
const getRandomLyrics = (db = lyrics) => {
  const albums = Object.keys(db.albums);

  const randomAlbumValue = getRandom(albums.length);
  //console.log('albums.length: ', albums.length);
  //console.log('randomAlbumValue: ', randomAlbumValue);
  const albumName = albums[randomAlbumValue];

  const randAlbum = db.albums[albumName];

  //console.log('===================================');
  const randomSongValue = getRandom(randAlbum.length);
  //console.log('randAlbum.length: ', randAlbum.length);
  //console.log('randomSongValue: ', randomSongValue);
  const song = randAlbum[randomSongValue];

  //console.log('===================================');
  const randomTextValue = getRandom(song.lyrics.length);
  //console.log('song.lyrics.length: ', song.lyrics.length);
  //console.log('randomTextValue: ', randomTextValue);
  const result = song.lyrics[randomTextValue];

  if (!result) {
    return getRandomLyrics();
  }

  return {
    name: song.name,
    text: result,
    album: albumName,
    fullLyrics: song.lyrics,
    textIndex: randomTextValue,
  };
};


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
