'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
/**
 * Command for obtaining the API token in Spotify
 */
async function cmdGetToken() {
  // We will create an embedded server for the callback
  const serverPort = process.env.TOKEN_SERVER_PORT ? process.env.TOKEN_SERVER_PORT : 30008;

  // Spotify authorization request parameters

  const authorizeURL = new URL('https://accounts.spotify.com/authorize');
  authorizeURL.search = new URLSearchParams({
    client_id: '6a10ce9a05774206980000f0f7f6dbc4',
    response_type: 'token',
    redirect_uri: `http://127.0.0.1:${serverPort}/callback`,
    scope: ['playlist-modify-public', 'playlist-modify-private'],
    state: `session-maker-for-spotify-${Math.random().toString(36)
      .slice(2)}`,
    show_dialog: true,
  });

  console.log(`Copy and paste the following URL in your browser: ${authorizeURL}`);

  let httpServer;
  await new Promise((resolve) => {
    httpServer = http.createServer((req, res) => {
      res.writeHead(200, {'Content-Type': 'text/html'});
      if (req.url.match(/callback/)) {
        res.end(fs.readFileSync(path.join(__dirname, '..', 'resources', 'server_body.html'), {encoding: 'utf-8'}));
        resolve();
      }
    }).listen(serverPort);
  });
  httpServer.close();
  console.log('Authentication finished');
  process.exit(0);
}

module.exports = cmdGetToken;
