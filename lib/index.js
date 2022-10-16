'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');
const Validator = require('jsonschema').Validator;

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema.json'), {encoding: 'utf-8'}));

function parseSession(sessionJson) {
  const inputDefinition = JSON.parse(sessionJson);
  const validator = new Validator();
  const validation = validator.validate(inputDefinition, schema);
  if (!validation.valid) {
    throw new Error(`Session file invalid: ${JSON.stringify(validation.errors)}`);
  }
  return inputDefinition;
}

function validateSession({sources, pattern}) {
  const sourceNames = sources.map(({name}) => name);
  const invalidDefinitions = pattern.filter((source) => !sourceNames.includes(source));
  if (invalidDefinitions.length > 0) {
    const invalidDefinitionStr = [...new Set(invalidDefinitions)].join(',');
    throw new Error(`Invalid definition, the following sources are unknown: ${invalidDefinitionStr}`);
  }
  return true;
}

function shuffle(array) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

async function buildSourceSongLists(sources, accessToken) {
  const sourceSongLists = {};
  for (let i = 0; i < sources.length; i += 1) {
    const name = sources[i].name;
    const spotifyID = sources[i].spotifyID;
    console.info(`Getting songs from playlist ${name}`);
    let stop = false;
    let currentOffset = 0;
    const nonShuffledArray = [];
    // Gather all songs in the playlist
    while (!stop) {
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      const tracks = await new Promise((resolve, reject) => {
        const params = new URLSearchParams({
          limit: 100,
          offset: currentOffset,
        });
        const opts = {
          hostname: 'api.spotify.com',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          path: `/v1/playlists/${spotifyID}/tracks?${params.toString()}`,
        };
        const req = https.request(opts, (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += Buffer.from(chunk).toString();
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              const parsedData = JSON.parse(rawData);
              // We need to remove local or the playlist creation will fail afterwards
              resolve(parsedData.items.map(({track}) => track.uri).filter((track) => track.match('spotify:track')));
            } else {
              reject(new Error(`Code: ${res.statusCode} - Msg: ${res.statusMessage}`));
            }
          });
        });
        req.end();
      });
      if (tracks.length > 0) {
        nonShuffledArray.push(...tracks);
        currentOffset += 100;
      } else {
        stop = true;
      }
    }

    // Once all songs are inside, shuffle the list
    sourceSongLists[name] = shuffle(nonShuffledArray);
  }

  return sourceSongLists;
}

function buildSessionSongList({pattern, maxSongs}, songLists) {
  const sessionSongList = [];
  const definitionLength = pattern.length;
  let addedSongs = 0;
  let patternPos = 0;
  let stop = false;

  while (!stop && (addedSongs < maxSongs)) {
    let isValidSong = false;
    let song;
    while (!isValidSong) {
      const currentSource = pattern[patternPos];
      song = songLists[currentSource].pop();
      if (!song) {
        console.warn(`Source ${currentSource} has run out of songs. Stopping`);
        stop = true;
        break;
      }
      if (!sessionSongList.includes(song)) {
        isValidSong = true;
      }
    }
    sessionSongList.push(song);
    addedSongs += 1;
    patternPos = (patternPos + 1) % definitionLength;
  }

  console.info(`Built list with ${addedSongs} Songs`);

  return sessionSongList;
}

// Create session using the definition
async function createPlaylist(session, {accessToken, user}) {
  validateSession(session);
  const sourceSongLists = await buildSourceSongLists(session.sources, accessToken);
  const sessionSongList = buildSessionSongList(session, sourceSongLists);
  let spotifyID = '';
  if (session.spotifyID) {
    spotifyID = session.spotifyID;
  } else {
    console.info(`Creating playlist with name  ${session.title}`);
    spotifyID = await new Promise((resolve, reject) => {
      const params = {
        name: session.title,
        description: session.description,
      };
      const opts = {
        hostname: 'api.spotify.com',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        path: `/v1/users/${user}/playlists`,
        method: 'POST',
      };
      const req = https.request(opts, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += Buffer.from(chunk).toString();
        });
        res.on('end', () => {
          if (res.statusCode === 201) {
            const parsedData = JSON.parse(rawData);
            resolve(parsedData.id);
          } else {
            reject(new Error(`Code: ${res.statusCode} - Msg: ${res.statusMessage}`));
          }
        });
      });
      req.write(JSON.stringify(params));
      req.end();
    });
  }
  let done = false;
  let offsetIndex = 0;
  console.debug(`Adding tracks to playlist ${spotifyID}`);
  while (!done) {
    // We need to go 100 by 100 because it is the limit by Spotify
    const batch = sessionSongList.slice(offsetIndex, offsetIndex + 100);
    if (batch.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        const params = {
          uris: batch,
        };
        const opts = {
          hostname: 'api.spotify.com',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          path: `/v1/playlists/${spotifyID}/tracks`,
          method: 'POST',
        };
        const req = https.request(opts, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode === 201) {
              resolve();
            } else {
              reject(new Error(`Code: ${res.statusCode} - Msg: ${res.statusMessage}`));
            }
          });
        });
        req.write(JSON.stringify(params));
        req.end();
      });
      offsetIndex += 100;
    } else {
      done = true;
    }
  }
}

module.exports = {
  createPlaylist,
  parseSession,
};
