
'use strict';

setTimeout(function() {
(function() {

function debug(str) {
  dump("MailWorker (parent): " + str + "\n");
}

var worker = new Worker("js/mailapi-worker.js");

worker.onhello = function() {
  worker.postMessage({
    type: 'hello',
    online: navigator.onLine,
    hasPendingAlarm: navigator.mozHasPendingMessage('alarm')
  }); 

  window.addEventListener('online', function() {
    worker.postMessage({ type: 'online' });
  });
  window.addEventListener('offline', function() {
    worker.postMessage({ type: 'online' });
  });

  // XXX Ensure that it works ???
  navigator.mozSetMessageHandler('alarm', function(msg) {
    worker.postMessage({ type: 'alarm', args: msg });
  });
}

worker.onbridge = function(data) {
  var msg = data.msg;
  if (msg.type != 'hello')
    return;

  var uid = data.uid;

  var mailAPI = new MailAPIBase();
  mailAPI.__bridgeSend = function(msg) {
    worker.postMessage({
      uid: uid,
      type: 'bridge',
      msg: msg
    });
  };

  worker.addEventListener('message', function(evt) {
    if (evt.data.type != 'bridge' || evt.data.uid != uid)
      return;

    dump("MailAPI receiveMessage: " + JSON.stringify(evt.data) + "\n");
    mailAPI.__bridgeReceive(evt.data.msg);
  });

  debug("config: " + data.msg.config);
  mailAPI.config = data.msg.config;

  var evt = document.createEvent('CustomEvent')
  evt.initCustomEvent('mailapi', true, false, { mailAPI: mailAPI });
  window.dispatchEvent(evt);
}

worker.onmaildb = function(msg) {
  MailIndexedDB.process(msg.uid, msg.cmd, msg.args);
}

worker.ontcpsocket = function(msg) {
  TCPSocket.process(msg.uid, msg.cmd, msg.args);
}

worker.oncronsyncer = function(msg) {
  CronSync.process(msg.uid, msg.cmd, msg.args);
}

worker.ondomparser = function(msg) {
  dump("ACCOUNT: asked for: " + msg.cmd + "\n");
  if (msg.cmd == 'parseconfig') { // accountcommon
    var doc = new DOMParser().parseFromString(msg.text, 'text/xml');
    var getNode = function(xpath, rel) {
      return doc.evaluate(xpath, rel || doc, null,
                          XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                            .singleNodeValue;
    }

    var provider = getNode('/clientConfig/emailProvider');
    // Get the first incomingServer we can use (we assume first == best).
    var incoming = getNode('incomingServer[@type="imap"] | ' +
                           'incomingServer[@type="activesync"]', provider);
    var outgoing = getNode('outgoingServer[@type="smtp"]', provider);

    var config = null;
    var status = null;
    if (incoming) {
      config = { type: null, incoming: {}, outgoing: {} };
      for (var iter in Iterator(incoming.children)) {
        var child = iter[1];
        dump("ACCOUNT: " + child.tagName + ":" + child.textContent +"\n");
        config.incoming[child.tagName] = child.textContent;
      }

      if (incoming.getAttribute('type') === 'activesync') {
        config.type = 'activesync';
      } else if (outgoing) {
        config.type = 'imap+smtp';
        for (var iter in Iterator(outgoing.children)) {
          var child = iter[1];
          dump("ACCOUNT: " + child.tagName + ":" + child.textContent +"\n");
          config.outgoing[child.tagName] = child.textContent;
        }

        // We do not support unencrypted connections outside of unit tests.
        dump("ACCOUNT: " + config.incoming.socketType + " : " + config.outgoing.socketType + "\n");
        if (config.incoming.socketType !== 'SSL' ||
            config.outgoing.socketType !== 'SSL') {
          config = null;
          status = 'unsafe';
        }
      } else {
        config = null;
        status = 'no-outgoing';
      }
    } else {
      status = 'no-incoming';
    }

    worker.postMessage({
      type: 'parseconfig',
      data: {
        config: config,
        status: status
      }
    });
  } else if (msg.cmd == 'parseactivesync') { 
dump("ACCOUNT: " + msg.text + "\n");
    var doc = new DOMParser().parseFromString(msg.text, 'text/xml');

    var getNode = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver,
                          XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                  .singleNodeValue;
    }
    var getNodes = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver,
                          XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    }
    var getString = function(xpath, rel) {
      return doc.evaluate(xpath, rel, nsResolver, XPathResult.STRING_TYPE,
                          null).stringValue;
    }

    var postResponse = function(error, config) {
      worker.postMessage({
        type: 'parseactivesync',
        data: {
          error: error || null,
          config: config || null,
        }
      });
    }

    var postAutodiscover = function(data) {
      worker.postMessage({
        type: 'parseactivesync',
        data: data
      });
    }
 
    var error = null;
    if (doc.documentElement.tagName === 'parsererror') {
      error = 'Error parsing autodiscover response';
      return postResponse(error);
    }

    var responseNode = getNode('/ad:Autodiscover/ms:Response', doc);
    if (!responseNode) {
      error = 'Missing Autodiscover Response node';
      return postResponse(error);
    }

    var error = getNode('ms:Error', responseNode) ||
                getNode('ms:Action/ms:Error', responseNode);
    if (error) {
      error = getString('ms:Message/text()', error);
      return postResponse(error);
    }

    var redirect = getNode('ms:Action/ms:Redirect', responseNode);
    if (redirect) {
      if (aNoRedirect) {
        error = 'Multiple redirects occurred during autodiscovery';
        return postResponse(error);
      }

      var redirectedEmail = getString('text()', redirect);
      return postResponse({
        redirectedEmail: redirectedEmail
      });
    }

    var user = getNode('ms:User', responseNode);
    var config = {
      culture: getString('ms:Culture/text()', responseNode),
      user: {
        name:  getString('ms:DisplayName/text()',  user),
        email: getString('ms:EMailAddress/text()', user),
      },
      servers: [],
    };

    var servers = getNodes('ms:Action/ms:Settings/ms:Server', responseNode);
    var server;
    while ((server = servers.iterateNext())) {
      config.servers.push({
        type:       getString('ms:Type/text()',       server),
        url:        getString('ms:Url/text()',        server),
        name:       getString('ms:Name/text()',       server),
        serverData: getString('ms:ServerData/text()', server),
      });
    }

    // Try to find a MobileSync server from Autodiscovery.
    for (var iter in Iterator(config.servers)) {
      var server = iter[1];
      if (server.type === 'MobileSync') {
        config.mobileSyncServer = server;
        break;
      }
    }

    if (!config.mobileSyncServer) {
      error = 'No MobileSync server found';
      return postResponse(error, config);
    }

    postResponse(null, config);

  }
}

worker.onmessage = function(event) {
  debug(JSON.stringify(event.data) + "\n");
  this['on' + event.data.type](event.data);
}


/* Cron Sync */
var CronSync = (function() {
  function clearAlarms() {
    var req = navigator.mozAlarms.getAll();
    req.onsuccess = function(event) {
      var alarms = event.target.result;
      for (var i = 0; i < alarms.length; i++) {
        navigator.mozAlarms.remove(alarms[i].id);
      }
    };
  }

  function addAlarm(time) {
    var req = navigator.mozAlarms.add(time, 'ignoreTimezone', {});

    req.onsuccess = function() {
      console.log('addAlarm: scheduled!');
    };

    req.onerror = function(event) {
      console.warn('addAlarm: scheduling problem!');
      var target = event.target;
      console.warn(' err:', target && target.error && target.error.name);
    };
  }

  function process(uid, cmd, args) {
    dump("CronSync: " + cmd + "\n");

    switch (cmd) {
      case 'clearAlarms':
        clearAlarms();
        break;
      case 'addAlarm':
        addAlarm.apply(this, args);
        break;
    }
  }

  return {
    process: process
  }
})();

/* TCP Socket */
var TCPSocket = {
  _sock: {},

  process: function(uid, cmd, args) {
    dump("TCPSocket: " + uid + ", " + cmd + ", " + JSON.stringify(args) + "\n");

    var postMessage = (function(uid, cmd, args) {
      worker.postMessage({
        type: 'tcpsocket',
        uid: uid,
        cmd: cmd,
        args: args
      });
    }).bind(this, uid);

    switch(cmd) {
      case 'open':
        var socket = navigator.mozTCPSocket;
        var sock = this._sock[uid] = socket.open(args[0], args[1], args[2]);
        sock.onopen = function(evt) {
          debug('onopen ' + uid + ": " + evt.data.toString());
          postMessage('onopen', evt.data);
        }
        sock.onerror = function(evt) {
          debug('onerror ' + uid + ": " + evt.data.toString());
          postMessage('onerror', evt.data);
        }
        sock.ondata = function(evt) {
          try {
            var str = 'NetSocket ondata: ';
            for (var i = 0; i < evt.data.byteLength; i++) {
              str += String.fromCharCode(evt.data[i]);
            }
            dump(str + '\n');
          } catch(e) {
          }
          debug('ondata ' + uid + ": " + new Uint8Array(evt.data));
          postMessage('ondata', new Uint8Array(evt.data));
        }
        sock.onclose = function(evt) {
          debug('onclose ' + uid + ": " + evt.data.toString());
          postMessage('onclose', evt.data.toString());
        }
        break;

      case 'end':
        this._sock[uid].close();
        break;

      case 'write':
        this._sock[uid].send(new Uint8Array(args[0]));
        break;
    }
  }
}


/* Mail Database */

var MailIndexedDB = (function() {
  function debug(str) {
    dump("MailWorker (main) IndexedDB: " + str + "\n");
  }

  var db = null;
  return {
    process: function(uid, cmd, args) {
      debug("receive: " + args);

      function postMessage(args) {
        worker.postMessage({
          uid: uid,
          type: 'maildb',
          cmd: cmd,
          args: Array.prototype.slice.call(args)
        });
      }

      switch (cmd) {
        case 'open':
          var onsuccess = function() {
            postMessage(arguments);
          }

          db = new MailDB(args[0], onsuccess);
          break;

        case 'getConfig':
        case 'loadHeaderBlock':
        case 'loadBodyBlock':
        case 'saveaccountfolderstates':
        case 'deleteAccount':
        case 'saveAccountDef':
        case 'saveConfig':
        case 'close':
          args.push(function() {
            postMessage(arguments);
          });
          db[cmd].apply(db, args);
          break;
      }
    }
  }
})();


var IndexedDB;
if (("indexedDB" in window) && window.indexedDB) {
  IndexedDB = self.indexedDB;
} else if (("mozIndexedDB" in window) && window.mozIndexedDB) {
  IndexedDB = self.mozIndexedDB;
} else if (("webkitIndexedDB" in self) && self.webkitIndexedDB) {
  IndexedDB = self.webkitIndexedDB;
} else {
  console.error("No IndexedDB!");
  throw new Error("I need IndexedDB; load me in a content page universe!");
}

/**
 * The current database version.
 *
 * Explanation of most recent bump:
 *
 * Bumping to 16 because header/body size estimates have been adjusted.
 */
var CUR_VERSION = 16;

/**
 * What is the lowest database version that we are capable of performing a
 * friendly-but-lazy upgrade where we nuke the database but re-create the user's
 * accounts?  Set this to the CUR_VERSION if we can't.
 *
 * Note that this type of upgrade can still be EXTREMELY DANGEROUS because it
 * may blow away user actions that haven't hit a server yet.
 */
var FRIENDLY_LAZY_DB_UPGRADE_VERSION = 5;

/**
 * The configuration table contains configuration data that should persist
 * despite implementation changes. Global configuration data, and account login
 * info.  Things that would be annoying for us to have to re-type.
 */
var TBL_CONFIG = 'config',
      CONFIG_KEY_ROOT = 'config',
      // key: accountDef:`AccountId`
      CONFIG_KEYPREFIX_ACCOUNT_DEF = 'accountDef:';

/**
 * The folder-info table stores meta-data about the known folders for each
 * account.  This information may be blown away on upgrade.
 *
 * While we may eventually stash info like histograms of messages by date in
 * a folder, for now this is all about serving as a directory service for the
 * header and body blocks.  See `ImapFolderStorage` for the details of the
 * payload.
 *
 * All the folder info for each account is stored in a single object since we
 * keep it all in-memory for now.
 *
 * key: `AccountId`
 */
var TBL_FOLDER_INFO = 'folderInfo';

/**
 * Stores time-clustered information about messages in folders.  Message bodies
 * and attachment names are not included, but initial snippets and the presence
 * of attachments are.
 *
 * We store headers separately from bodies because our access patterns are
 * different for each.  When we want headers, all we want is headers, and don't
 * need the bodies clogging up our IO.  Additionally, we expect better
 * compression for bodies if they are stored together.
 *
 * key: `FolderId`:`BlockId`
 *
 * Each value is an object dictionary whose keys are either UIDs or a more
 * globally unique identifier (ex: gmail's X-GM-MSGID values).  The values are
 * the info on the message; see `ImapFolderStorage` for details.
 */
var TBL_HEADER_BLOCKS = 'headerBlocks';
/**
 * Stores time-clustered information about message bodies.  Body details include
 * the list of attachments, as well as the body payloads and the embedded inline
 * parts if they all met the sync heuristics.  (If we can't sync all the inline
 * images, for example, we won't sync any.)
 *
 * Note that body blocks are not paired with header blocks; their storage is
 * completely separate.
 *
 * key: `FolderId`:`BlockId`
 *
 * Each value is an object dictionary whose keys are either UIDs or a more
 * globally unique identifier (ex: gmail's X-GM-MSGID values).  The values are
 * the info on the message; see `ImapFolderStorage` for details.
 */
var TBL_BODY_BLOCKS = 'bodyBlocks';

/**
 * DB helper methods for Gecko's IndexedDB implementation.  We are assuming
 * the presence of the Mozilla-specific mozGetAll helper right now.  Since our
 * app is also dependent on the existence of the TCP API that no one else
 * supports right now and we are assuming a SQLite-based IndexedDB
 * implementation, this does not seem too crazy.
 *
 * == Useful tidbits on our IndexedDB implementation
 *
 * - SQLite page size is 32k
 * - The data persisted to the database (but not Blobs AFAICS) gets compressed
 *   using snappy on a per-value basis.
 * - Blobs/files are stored as files on the file-system that are referenced by
 *   the data row.  Since they are written in one go, they are highly unlikely
 *   to be fragmented.
 * - Blobs/files are clever once persisted.  Specifically, nsDOMFileFile
 *   instances are created with just the knowledge of the file-path.  This means
 *   the data does not have to be marshaled, and it means that it can be
 *   streamed off the disk.  This is primarily beneficial in that if there is
 *   data we don't need to mutate, we can feed it directly to the web browser
 *   engine without potentially creating JS string garbage.
 *
 * Given the page size and snappy compression, we probably only want to spill to
 * a blob for non-binary data that exceeds 64k by a fair margin, and less
 * compressible binary data that is at least 64k.
 *
 * @args[
 *   @param[testOptions #:optional @dict[
 *     @key[dbVersion #:optional Number]{
 *       Override the database version to treat as the database version to use.
 *       This is intended to let us do simple database migration testing by
 *       creating the database with an old version number, then re-open it
 *       with the current version and seeing a migration happen.  To test
 *       more authentic migrations when things get more complex, we will
 *       probably want to persist JSON blobs to disk of actual older versions
 *       and then pass that in to populate the database.
 *     }
 *     @key[nukeDb #:optional Boolean]{
 *       Compel ourselves to nuke the previous database state and start from
 *       scratch.  This only has an effect when IndexedDB has fired an
 *       onupgradeneeded event.
 *     }
 *   ]]
 * ]
 */
function MailDB(testOptions, successCb, errorCb, upgradeCb) {
  this._db = null;

  this._lazyConfigCarryover = null;

  /**
   * Fatal error handler.  This gets to be the error handler for all unexpected
   * error cases.
   */
  this._fatalError = function(event) {
    function explainSource(source) {
      if (!source)
        return 'unknown source';
      if (source instanceof IDBObjectStore)
        return 'object store "' + source.name + '"';
      if (source instanceof IDBIndex)
        return 'index "' + source.name + '" on object store "' +
          source.objectStore.name + '"';
      if (source instanceof IDBCursor)
        return 'cursor on ' + explainSource(source.source);
      return 'unexpected source';
    }
    var explainedSource, target = event.target;
    if (target instanceof IDBTransaction) {
      explainedSource = 'transaction (' + target.mode + ')';
    }
    else if (target instanceof IDBRequest) {
      explainedSource = 'request as part of ' +
        (target.transaction ? target.transaction.mode : 'NO') +
        ' transaction on ' + explainSource(target.source);
    }
    else { // dunno, ask it to stringify itself.
      explainedSource = target.toString();
    }
    console.error('indexedDB error:', target.error.name, 'from',
                  explainedSource);
  };

  var dbVersion = CUR_VERSION;
  if (testOptions && testOptions.dbVersion)
    dbVersion = testOptions.dbVersion;
  var openRequest = IndexedDB.open('b2g-email', dbVersion), self = this;
  openRequest.onsuccess = function(event) {
    self._db = openRequest.result;

    successCb();
  };
  openRequest.onupgradeneeded = function(event) {
    var db = openRequest.result;

    // - reset to clean slate
    if ((event.oldVersion < FRIENDLY_LAZY_DB_UPGRADE_VERSION) ||
        (testOptions && testOptions.nukeDb)) {
      self._nukeDB(db);
    }
    // - friendly, lazy upgrade
    else {
      var trans = openRequest.transaction;
      // Load the current config, save it off so getConfig can use it, then nuke
      // like usual.  This is obviously a potentially data-lossy approach to
      // things; but this is a 'lazy' / best-effort approach to make us more
      // willing to bump revs during development, not the holy grail.
      self.getConfig(function(configObj, accountInfos) {
        if (configObj)
          self._lazyConfigCarryover = {
            oldVersion: event.oldVersion,
            config: configObj,
            accountInfos: accountInfos
          };
        self._nukeDB(db);
      }, trans);
    }
  };
  openRequest.onerror = this._fatalError;
}

MailDB.prototype = {
  /**
   * Reset the contents of the database.
   */
  _nukeDB: function(db) {
    var existingNames = db.objectStoreNames;
    for (var i = 0; i < existingNames.length; i++) {
      db.deleteObjectStore(existingNames[i]);
    }

    db.createObjectStore(TBL_CONFIG);
    db.createObjectStore(TBL_FOLDER_INFO);
    db.createObjectStore(TBL_HEADER_BLOCKS);
    db.createObjectStore(TBL_BODY_BLOCKS);
  },

  close: function() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  },

  getConfig: function(callback) {
    debug("enter getConfig");
    var transaction = this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO],
                                           'readonly');
    var configStore = transaction.objectStore(TBL_CONFIG),
        folderInfoStore = transaction.objectStore(TBL_FOLDER_INFO);

    // these will fire sequentially
    var configReq = configStore.mozGetAll(),
        folderInfoReq = folderInfoStore.mozGetAll();

    configReq.onerror = this._fatalError;
    // no need to track success, we can read it off folderInfoReq
    folderInfoReq.onerror = this._fatalError;
    var self = this;
    folderInfoReq.onsuccess = function(event) {
      var configObj = null, accounts = [], i, obj;

      // - Check for lazy carryover.
      // IndexedDB provides us with a strong ordering guarantee that this is
      // happening after any upgrade check.  Doing it outside this closure would
      // be race-prone/reliably fail.
      if (self._lazyConfigCarryover) {
        var lazyCarryover = self._lazyConfigCarryover;
        self._lazyConfigCarryover = null;
        callback(configObj, accounts, lazyCarryover);
        return;
      }

      // - Process the results
      for (i = 0; i < configReq.result.length; i++) {
        obj = configReq.result[i];
        if (obj.id === 'config')
          configObj = obj;
        else
          accounts.push({def: obj, folderInfo: null});
      }
      for (i = 0; i < folderInfoReq.result.length; i++) {
        accounts[i].folderInfo = folderInfoReq.result[i];
      }

      try {
        callback(configObj, accounts);
      }
      catch(ex) {
        console.error('Problem in configCallback', ex, '\n', ex.stack);
      }
    };
  },

  saveConfig: function(config) {
    var req = this._db.transaction(TBL_CONFIG, 'readwrite')
                        .objectStore(TBL_CONFIG)
                        .put(config, 'config');
    req.onerror = this._fatalError;
  },

  /**
   * Save the addition of a new account or when changing account settings.  Only
   * pass `folderInfo` for the new account case; omit it for changing settings
   * so it doesn't get updated.  For coherency reasons it should only be updated
   * using saveAccountFolderStates.
   */
  saveAccountDef: function(config, accountDef, folderInfo) {
    var trans = this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO],
                                     'readwrite');

    var configStore = trans.objectStore(TBL_CONFIG);
    configStore.put(config, 'config');
    configStore.put(accountDef, CONFIG_KEYPREFIX_ACCOUNT_DEF + accountDef.id);
    if (folderInfo) {
      trans.objectStore(TBL_FOLDER_INFO)
           .put(folderInfo, accountDef.id);
    }
    trans.onerror = this._fatalError;
  },

  loadHeaderBlock: function(folderId, blockId, callback) {
    var req = this._db.transaction(TBL_HEADER_BLOCKS, 'readonly')
                         .objectStore(TBL_HEADER_BLOCKS)
                         .get(folderId + ':' + blockId);
    req.onerror = this._fatalError;
    req.onsuccess = function() {
      callback(req.result);
    };
  },

  loadBodyBlock: function(folderId, blockId, callback) {
    var req = this._db.transaction(TBL_BODY_BLOCKS, 'readonly')
                         .objectStore(TBL_BODY_BLOCKS)
                         .get(folderId + ':' + blockId);
    req.onerror = this._fatalError;
    req.onsuccess = function() {
      callback(req.result);
    };
  },

  /**
   * Coherently update the state of the folderInfo for an account plus all dirty
   * blocks at once in a single (IndexedDB and SQLite) commit. If we broke
   * folderInfo out into separate keys, we could do this on a per-folder basis
   * instead of per-account.  Revisit if performance data shows stupidity.
   *
   * @args[
   *   @param[accountId]
   *   @param[folderInfo]
   *   @param[perFolderStuff @listof[@dict[
   *     @key[id FolderId]
   *     @key[headerBlocks @dictof[@key[BlockId] @value[HeaderBlock]]]
   *     @key[bodyBlocks @dictof[@key[BlockID] @value[BodyBlock]]]
   *   ]]]
   * ]
   */
  saveAccountFolderStates: function(accountId, folderInfo, perFolderStuff,
                                    deletedFolderIds,
                                    callback, reuseTrans) {
    var trans = reuseTrans ||
      this._db.transaction([TBL_FOLDER_INFO, TBL_HEADER_BLOCKS,
                           TBL_BODY_BLOCKS],
                           'readwrite');
    trans.onerror = this._fatalError;
    trans.objectStore(TBL_FOLDER_INFO).put(folderInfo, accountId);
    var headerStore = trans.objectStore(TBL_HEADER_BLOCKS),
        bodyStore = trans.objectStore(TBL_BODY_BLOCKS), i;

    for (i = 0; i < perFolderStuff.length; i++) {
      var pfs = perFolderStuff[i], block;

      for (var headerBlockId in pfs.headerBlocks) {
        block = pfs.headerBlocks[headerBlockId];
        if (block)
          headerStore.put(block, pfs.id + ':' + headerBlockId);
        else
          headerStore.delete(pfs.id + ':' + headerBlockId);
      }

      for (var bodyBlockId in pfs.bodyBlocks) {
        block = pfs.bodyBlocks[bodyBlockId];
        if (block)
          bodyStore.put(block, pfs.id + ':' + bodyBlockId);
        else
          bodyStore.delete(pfs.id + ':' + bodyBlockId);
      }
    }

    if (deletedFolderIds) {
      for (i = 0; i < deletedFolderIds.length; i++) {
        var folderId = deletedFolderIds[i],
            range = IDBKeyRange.bound(folderId + ':',
                                      folderId + ':\ufff0',
                                      false, false);
        headerStore.delete(range);
        bodyStore.delete(range);
      }
    }

    if (callback)
      trans.addEventListener('complete', callback);

    return trans;
  },

  /**
   * Delete all traces of an account from the database.
   */
  deleteAccount: function(accountId, reuseTrans) {
    var trans = reuseTrans ||
      this._db.transaction([TBL_CONFIG, TBL_FOLDER_INFO, TBL_HEADER_BLOCKS,
                           TBL_BODY_BLOCKS],
                           'readwrite');
    trans.onerror = this._fatalError;

    trans.objectStore(TBL_CONFIG).delete('accountDef:' + accountId);
    trans.objectStore(TBL_FOLDER_INFO).delete(accountId);
    var range = IDBKeyRange.bound(accountId + '/',
                                  accountId + '/\ufff0',
                                  false, false);
    trans.objectStore(TBL_HEADER_BLOCKS).delete(range);
    trans.objectStore(TBL_BODY_BLOCKS).delete(range);
  },
};

})();

// XXX Let's start the network a bit later.
});
