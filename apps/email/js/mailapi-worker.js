
'use strict';

function debug(str) {
  dump('MailWorker (remote): ' + str + '\n');
}

self.onmessage = function(event) {
  debug(event.data);
}
self.postMessage("hello");

var window = self;

// XXX Move it to the other side
navigator.mozApps = {
  getSelf: function() {
    return {
      onsuccess: null,
      onerror: null
    }
  }
}

var TextEncoder = function() {
  return {
    decode: function(str) {
      return str;
    },

    encode: function(str) {
      return str;
    }
  }
}
TextEncoder.encode = function(str) {
  return str;
}
TextEncoder.decode = function(str) {
  return str;
}

var console = {
  log: function (str) {
    debug('console.log: ' + str);
  },

  warn: function(str) {
    debug('console.warn: ' + str);
  },

  error: function(str) {
    debug('console.error: ' + str);
  }
}


// XXX Let's remote navigator online/offline
addEventListener('message', function(evt) {
});

var scripts = [
  'ext/almond.js',
  'ext/event-queue.js',
  'ext/buffer.js',
  'ext/mailapi/shim-sham.js',
  'ext/mailapi/mailapi.js',
  'ext/q.js',
  'ext/microtime.js',
  'ext/rdcommon/extransform.js',
  'ext/rdcommon/log.js',
  'ext/mailapi/util.js',
  'ext/mailapi/quotechew.js',
  'ext/bleach.js',
  'ext/mailapi/htmlchew.js',
  'ext/mailapi/mailchew.js',
  'ext/events.js',
  'ext/util.js',
  'ext/stream.js',
  'ext/encoding.js',
  'ext/addressparser/index.js',
  'ext/addressparser.js',
  'ext/mimelib/lib/mimelib.js',
  'ext/mimelib/lib/content-types.js',
  'ext/mimelib/lib/content-types-reversed.js',
  'ext/mimelib/index.js',
  'ext/mimelib.js',
  'ext/mailcomposer/lib/punycode.js',
  'ext/crypto.js',
  'ext/mailcomposer/lib/dkim.js',
  'ext/http.js',
  'ext/https.js',
  'ext/url.js',
  'ext/mailcomposer/lib/urlfetch.js',
  'ext/fs.js',
  'ext/mailcomposer/lib/mailcomposer.js',
  'ext/mailcomposer.js',
  'ext/mailapi/composer.js',
  'ext/mailapi/mailbridge.js',
  'ext/rdcommon/logreaper.js',
  'ext/mailapi/a64.js',
  'ext/mailapi/date.js',
  'ext/mailapi/syncbase.js',
  'ext/mailapi/maildb.js',
  'ext/mailapi/allback.js',
  'ext/mailapi/cronsync.js',
  'ext/net.js',
  'ext/tls.js',
  'ext/mailparser/datetime.js',
  'ext/mailparser/streams.js',
  'ext/mailparser/mailparser.js',
  'ext/imap.js',
  'ext/mailapi/imap/probe.js',
  'ext/os.js',
  'ext/simplesmtp/lib/starttls.js',
  'ext/xoauth2.js',
  'ext/simplesmtp/lib/client.js',
  'ext/mailapi/smtp/probe.js',
  'ext/wbxml.js',
  'ext/activesync/codepages.js',
  'ext/activesync/protocol.js',
  'ext/mailapi/accountmixins.js',
  'ext/mailapi/errbackoff.js',
  'ext/mailapi/mailslice.js',
  'ext/mailapi/searchfilter.js',
  'ext/mailapi/imap/imapchew.js',
  'ext/mailapi/imap/folder.js',
  'ext/mailapi/jobmixins.js',
  'ext/mailapi/imap/jobs.js',
  'ext/mailapi/imap/account.js',
  'ext/mailapi/smtp/account.js',
  'ext/mailapi/fake/account.js',
  'ext/mailapi/activesync/folder.js',
  'ext/mailapi/activesync/jobs.js',
  'ext/mailapi/activesync/account.js',
  'ext/mailapi/accountcommon.js',
  'ext/mailapi/mailuniverse.js',
  'ext/mailapi/same-frame-setup.js',
  'ext/end.js',
];

scripts.forEach(function loadScript(path) {
  importScripts(path);
});

