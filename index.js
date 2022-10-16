'use strict';

const {program, Option} = require('commander');
const cmdCreatePlaylist = require('./cmd/create-playlist');
const cmdGetToken = require('./cmd/get-token');

const version = '1.0.0';

// Basic metadata
program
  .name('session-maker-for-spotify')
  .description('Create Spotify sessions using multiple playlists')
  .version(version);

// Commands
program.command('create-playlist')
  .description('Create playlist based on a session file')
  .addOption(new Option('-a --access-token <key>', 'Spotify Access token').env('ACCESS_TOKEN')
    .makeOptionMandatory())
  .addOption(new Option('-s --session <file>', 'Session definition').env('SESSION_FILE')
    .makeOptionMandatory())
  .action((opts) => {
    if (!opts.accessToken) {
      throw new Error('Missing access token. Please execute "session-maker-for-spotify get-token"');
    }
    cmdCreatePlaylist(opts);
  });

program.command('get-token')
  .description('Get token for accessing the Spotify API')
  .action((opts) => {
    cmdGetToken(opts);
  });

program.parse();
