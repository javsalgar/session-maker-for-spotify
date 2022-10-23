'use strict';

const fs = require('fs');
const https = require('https');
const {createPlaylist, parseSession} = require('../lib');

/**
 * Command for creating the playlist in Spotify
 * @param  {string} input.sessionPath Path to the session file
 * @param  {string} input.accessToken Spotify API token for performing operations
 */
async function cmdCreatePlaylist({session: sessionPath, accessToken}) {
  const definition = parseSession(fs.readFileSync(sessionPath), {encoding: 'utf-8'});

  console.info('Verifying access token');
  let user;
  try {
    user = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.spotify.com',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        path: '/v1/me',
      };
      const req = https.request(opts, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += Buffer.from(chunk).toString();
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const parsedJSON = JSON.parse(rawData);
            resolve(parsedJSON.id);
          } else {
            reject(new Error(`Code: ${res.statusCode} - Msg: ${res.statusMessage}`));
          }
        });
      });
      req.end();
    });
  } catch (e) {
    throw new Error(`Token verification failed: ${e}. Please run session-maker-for-spotify get-token`);
  }
  console.info(`Token verified successfully. User: ${user}`);
  await createPlaylist(definition, {accessToken, user});
  console.info('Playlist created successfully!');
}

module.exports = cmdCreatePlaylist;
