# session-maker-for-spotify

Session Maker for Spotify is a playlist creator using multiple Spotify playlists as a source.
It allows users to create custom patterns to ensure that their playlists are balanced.

## Installation

```
npm install -g session-maker-for-spotify
```

Alternatively, you can use a Docker container:

```
docker run --rm --ti javsalgar/session-maker-for-spotify
```

## Usage

### Getting a Spotify access token

In order to use the program you need a Spotify access token, this is done by executing this command:

```
session-maker-for-spotify get-token
```

You will be prompted to enter a URL for authenticating with Spotify. After that, you will be redirected to a simple page showing the token. Copy it so you can use it for the `create-playlist` command.

### Creating a session definition file

Session maker for Spotify works with session definitions, which are `JSON` files with the following structure:

```
{
  "title": "<TITLE OF THE PLAYLIST TO CREATE>",
  "description": "<DESCRIPTION OF THE PLAYLIST>",
  "maxSongs": <MAXIMUM NUMBER OF SONGS>,
  "sources": [ <-- Here goes the source playlists you want to use
    {
      "name": "<Internal identifier of playlist>",
      "spotifyID": "<Spotify ID of the Playlist>"
    },
    {
      "name": "<Internal identifier of playlist>",
      "spotifyID": "<Spotify ID of the Playlist>"
    },
    ...
  ],
  "pattern": [
    "<Playlist Identifier>",
    "<Playlist Identifier>",
    "<Playlist Identifier>",
  ]
}
```

In essence, you define a set of existing Spotify playlists, and you define a pattern in which you want
the songs to be added to the resulting playlist. See the [Example usage](#example-usage) for more details.
Also, the [JSON Schema](https://github.com/javsalgar/spotify-session-maker/blob/main/schema.json) is available in the repository.

You can get the Spotify ID of a playlist by sharing a link to it. For example:

```
https://open.spotify.com/playlist/2OsWOxpOhmPUqISvPo8Cph?si=1ff1c2015de348a1
```

For this example, the ID would be `2OsWOxpOhmPUqISvPo8Cph`.

### Creating a playlist using the session definition

Once you have a session definition, you can create the playlist with this command:

```
session-maker-for-spotify create-playlist --access-token <key> --session <file>
```

The command will check the access token and create the playlist. You can check in
your Spotify app the resulted playlist. Enjoy!

## Example usage

For this case, we want to create a music session like this:

- 40% Salsa music
- 40% Bachata music
- 20% Kizomba

What is more, we want to have 2 Salsa songs followed by 2 Bachata songs followed
by one Kizomba song. In order to allow this, we use three playlist:

- Salsa: playlist containing only Salsa songs.
- Bachata: playlist containing only Bachata songs.
- Kizomba: playlist containing only Kizomba songs.

The session definition would look like this:

```
{
  "title": "My awesome SBK Party!",
  "description": "Created with session-maker-for-spotify",
  "maxSongs": 200,
  "sources": [
    {
      "name": "Salsa",
      "spotifyID": "2OsWOxpOhmPUqISvPo8Cph"
    },
    {
      "name": "Bachata",
      "spotifyID": "7LsJLGdokIxHxcmGMlXB3m"
    },
    {
      "name": "Kizomba",
      "spotifyID": "2godpxQkfAuR9JRJ7tU5ws"
    }
  ],
  "pattern": [
    "Salsa",
    "Salsa",
    "Bachata",
    "Bachata",
    "Kizomba"
  ]
}
```

# Contributing
We'd love for you to contribute to this software. You can request new features by creating an issue, or submit a pull request with your contribution.

# License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
