
function MusicBackend() {
  'use strict';

  log('starting...');

  function log(str) {
    console.log('Music Backend: ' + str);
  }

  function onMessage(data) {
    var uuid = data.uuid;
    var url = data.url;

    for (var path in window.ROUTES) {
      var route = window.ROUTES[path];
      var match = url.match(route.regexp);

      if (match) {
        return new Promise((resolve) => {
          setTimeout(() => {
            var args = [route.method].concat(match.splice(1));
            client.method.apply(window.client, args).then((result) => {
              resolve({
                uuid: uuid,
                blob: result,
                json: result
              });
            });
          });
        });
      }
    }

    return Promise.reject();
  }

  function onConnection(request) {
    var keyword = request.keyword;
    var port = request.port;
    port.onmessage = function(msg) {
      onMessage(msg.data).then((rv) => {
        port.postMessage(rv);
      });
    }
    port.start();
  }

  function init() {
    navigator.mozSetMessageHandler('connection', onConnection);
  }


  init.call(this);

  log('started.');
};

var backend = new MusicBackend();

(function() {
  window.ROUTES = {
    '/api/activities/share/:filePath': 'share',

    '/api/albums/list': 'getAlbums',
    '/api/albums/info/:filePath': 'getAlbum',

    '/api/artists/list': 'getArtists',
    '/api/artists/info/:filePath': 'getArtist',

    '/api/artwork/original/:filePath': 'getSongArtwork',
    '/api/artwork/thumbnail/:filePath': 'getSongThumbnail',
    '/api/artwork/url/original/:filePath': 'getSongArtworkURL',
    '/api/artwork/url/thumbnail/:filePath': 'getSongThumbnailURL',

    '/api/audio/play': 'play',
    '/api/audio/pause': 'pause',
    '/api/audio/seek/:time': 'seek',
    '/api/audio/fastseek/start/:direction': 'startFastSeek',
    '/api/audio/fastseek/stop': 'stopFastSeek',
    '/api/audio/status': 'getPlaybackStatus',

    '/api/database/status': 'getDatabaseStatus',

    '/api/playlists/list': 'getPlaylists',
    '/api/playlists/info/:id': 'getPlaylist',

    '/api/queue/current': 'currentSong',
    '/api/queue/previous': 'previousSong',
    '/api/queue/next': 'nextSong',
    '/api/queue/album/:filePath': 'queueAlbum',
    '/api/queue/artist/:filePath': 'queueArtist',
    '/api/queue/playlist/:id/shuffle': 'queuePlaylist',
    '/api/queue/playlist/:id/song/:filePath': 'queuePlaylist',
    '/api/queue/song/:filePath': 'queueSong',
    '/api/queue/repeat/:repeat': 'setRepeatSetting',
    '/api/queue/shuffle/:shuffle': 'setShuffleSetting',

    '/api/songs/list': 'getSongs',
    '/api/songs/count': 'getSongCount',
    '/api/songs/info/:filePath': 'getSong',
    '/api/songs/rating/:rating/:filePath': 'setSongRating',

    '/api/search/:key/': 'search',
    '/api/search/:key/:query': 'search'
  };

  for (var path in window.ROUTES) {
    var method = window.ROUTES[path];
    window.ROUTES[path] = parseSimplePath(path);
    window.ROUTES[path].method = method;
  }
})();

/**
 * Route parser from components/serviceworkerware/dist/sww.js
 */
function parseSimplePath(path) {
  // Check for named placeholder crowding
  if (/\:[a-zA-Z0-9]+\:[a-zA-Z0-9]+/g.test(path)) {
    throw new Error('Invalid usage of named placeholders');
  }

  // Check for mixed placeholder crowdings
  var mixedPlaceHolders =
    /(\*\:[a-zA-Z0-9]+)|(\:[a-zA-Z0-9]+\:[a-zA-Z0-9]+)|(\:[a-zA-Z0-9]+\*)/g;
  if (mixedPlaceHolders.test(path.replace(/\\\*/g,''))) {
    throw new Error('Invalid usage of named placeholders');
  }

  // Try parsing the string and converting special characters into regex
  try {
    // Parsing anonymous placeholders with simple backslash-escapes
    path = path.replace(/(.|^)[*]+/g, function(m,escape) {
      return escape==='\\' ? '\\*' : (escape+'(?:.*?)');
    });

    // Parsing named placeholders with backslash-escapes
    var tags = [];
    path = path.replace(/(.|^)\:([a-zA-Z0-9]+)/g, function (m, escape, tag) {
      if (escape === '\\') { return ':' + tag; }
      tags.push(tag);
      return escape + '(.+?)';
    });

    return { regexp: RegExp(path + '$'), tags: tags };
  }

  // Failed to parse final path as a RegExp
  catch (ex) {
    throw new Error('Invalid path specified');
  }
}
