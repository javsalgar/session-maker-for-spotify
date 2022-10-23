'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');
const Validator = require('jsonschema').Validator;

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema.json'), {encoding: 'utf-8'}));

/**
 * Parse and validate the session string with the expected schema
 * @param  {string} sessionJson String containing the JSON specification
 */
function parseSession(sessionJson) {
  const inputDefinition = JSON.parse(sessionJson);
  const validator = new Validator();
  const validation = validator.validate(inputDefinition, schema);
  if (!validation.valid) {
    throw new Error(`Session file invalid: ${JSON.stringify(validation.errors)}`);
  }
  return inputDefinition;
}

/**
 * Ensure that all the references in the pattern are declared in the "sources" section
 *
 * Example: Valid session
 *   Declared sources: [Salsa, Bachata, Kizomba]
 *   Pattern: [Salsa, Salsa, Kizomba, Kizomba, Bachata, Bachata]
 *
 * Example: Invalid session
 *   Declared sources: [Salsa, Bachata]
 *   Pattern: [Salsa, Bachata, Bachata, Kizomba, Salsa]
 *
 * @param  {Object} session.sources Object with the source definition
 * @param  {string[]} pattern Session pattern using declared sources
 */
function validateSession({sources, pattern}) {
  const sourceNames = sources.map(({name}) => name);
  const invalidDefinitions = pattern.filter((source) => !sourceNames.includes(source));
  if (invalidDefinitions.length > 0) {
    const invalidDefinitionStr = [...new Set(invalidDefinitions)].join(',');
    throw new Error(`Invalid definition, the following sources are unknown: ${invalidDefinitionStr}`);
  }
  return true;
}
/**
 * Shuffle the elements in the array using the Fisher-Yates algorithm
 * @param  {string[]} array Array with the Spotify IDs of a playlist
 */
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
/**
 * Obtain the list of songs of a given playlist
 * @param  {string} spotifyID Spotify ID of the playlist
 * @param  {string} accessToken Spotify API token for performing operations
 */
async function getSongsFromPlaylist(spotifyID, accessToken) {
  console.info(`Getting songs from playlist ${spotifyID}`);
  let stop = false;
  let currentOffset = 0;
  const songs = [];
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
      songs.push(...tracks);
      currentOffset += 100;
    } else {
      stop = true;
    }
  }
  // Remove duplicates
  return [...new Set(songs)];
}
/**
 * Build the song lists of a given playlist group. It takes the songs from each playlist and
 * performs a random shuffle
 * @param  {Object[]} sources List of source playlist groups
 * @param  {string} accessToken Spotify API token for performing operations
 */
async function buildSourceSongLists(sources, accessToken) {
  const sourceSongLists = {};
  const playlistSongs = {};
  const keys = [...new Set(sources.map((source) => source.spotifyIDs).flat())];
  for (let i = 0; i < keys.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop, no-loop-func
    playlistSongs[keys[i]] = await getSongsFromPlaylist(keys[i], accessToken);
  }
  sources.forEach(({name, spotifyIDs}) => {
    const nonShuffledArray = [...new Set(spotifyIDs.map((id) => playlistSongs[id]).flat())];
    // Once all songs are inside, shuffle the list
    sourceSongLists[name] = shuffle(nonShuffledArray);
  });

  return sourceSongLists;
}
/**
 * Build the final session using the pattern and the different source playlist groups
 * with a given maximum number of songs
 * @param  {string[]} session.pattern Pattern for adding songs to the session using declared source playlist groups
 * @param  {Number} session.maxSongs Maximum number of songs to add
 * @param  {Object} songLists List of songs of each source playlist group
 */
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

/**
 * Create the playlist in Spotify
 * @param  {Object} session Session definition
 * @param  {string} credentials.accessToken Spotify API token for performing operations
 * @param  {string} credentials.user Spotify user to associate the playlist to
 */
async function createPlaylist(session, {accessToken, user}) {
  validateSession(session);
  const sourceSongLists = await buildSourceSongLists(session.sources, accessToken);
  const sessionSongList = buildSessionSongList(session, sourceSongLists);
  // Create the playlist
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
  // Add songs to the playlist
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
