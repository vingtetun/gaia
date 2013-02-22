
'use strict';

var WorkerListener;

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
    dump("CronSyncer (main) - receive an alarm via a message handler\n");
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

worker.oncronsyncer = function(msg) {
  dump("CronSyncer (main) " + msg.cmd + "\n");
  CronSync.process(msg.uid, msg.cmd, msg.args);
}

worker.ondevicestorage = function(msg) {
  dump("DeviceStorage (main) " + msg.cmd + "\n");
  DeviceStorage.process(msg.uid, msg.cmd, msg.args);
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

WorkerListener = {
  register: function(module) {
    var name = module.name;

    worker['on' + name] = function(msg) {
      dump("WL process " + name + ": " + msg.uid + " - " + msg.cmd + "\n");
      module.process(msg.uid, msg.cmd, msg.args);
    };

    module.onmessage = function(uid, cmd, args) {
      dump("WL: onmessage " + name + ": " + uid + " - " + cmd + "\n");
      worker.postMessage({
        type: name,
        uid: uid,
        cmd: cmd,
        args: Array.isArray(args) ? args : [args]
      });
    }
  }
}


/* Cron Sync */
var DeviceStorage = (function() {
  function debug(str) {
    dump("DeviceStorage (main): " + str + "\n");
  }

  var postMessage = function(uid, cmd, args) {
    worker.postMessage({
      type: 'devicestorage',
      uid: uid,
      cmd: cmd,
      args: Array.isArray(args) ? args : [args]
    });
  };

  function process(uid, cmd, args) {
    switch (cmd) {
      case 'save':
        var storage = args[0], blob = args[1], filename = args[2];
        var dstorage = navigator.getDeviceStorage(storage);
        var req = dstorage.addNamed(blob, filename);
        req.onerror = function() {
          postMessage(uid, cmd, false);
        }

        req.onsuccess = function() {
          postMessage(uid, cmd, true);
        }
        break;
    }
  }

  return {
    process: process
  }
})();


/* Cron Sync */
var CronSync = (function() {
  function debug(str) {
    dump("CronSyncer (main): " + str + "\n");
  }

  var postMessage = function(uid, cmd, args) {
    worker.postMessage({
      type: 'cronsyncer',
      uid: uid,
      cmd: cmd,
      args: Array.isArray(args) ? args : [args]
    });
  }

  function clearAlarms() {
    var req = navigator.mozAlarms.getAll();
    req.onsuccess = function(event) {
      var alarms = event.target.result;
      for (var i = 0; i < alarms.length; i++) {
        navigator.mozAlarms.remove(alarms[i].id);
      }

      debug("alarms deleted");
    };
  }

  function addAlarm(time) {
    var req = navigator.mozAlarms.add(time, 'ignoreTimezone', {});

    req.onsuccess = function() {
      debug('addAlarm: scheduled!');
    };

    req.onerror = function(event) {
      debug('addAlarm: scheduling problem!');
      var target = event.target;
      console.warn(' err:', target && target.error && target.error.name);
    };
  }

  var gApp, gIconUrl;
  navigator.mozApps.getSelf().onsuccess = function(event) {
    gApp = event.target.result;
    gIconUrl = gApp.installOrigin + '/style/icons/Email.png';
  };

  /**
   * Try and bring up the given header in the front-end.
   *
   * XXX currently, we just cause the app to display, but we don't do anything
   * to cause the actual message to be displayed.  Right now, since the back-end
   * and the front-end are in the same app, we can easily tell ourselves to do
   * things, but in the separated future, we might want to use a webactivity,
   * and as such we should consider using that initially too.
   */
  function displayHeaderInFrontEnd(header) {
    gApp.launch();
  }

  function showNotification(uid, title, body) {
    var success = function() {
      postMessage(uid, 'showNotification', true);
    }

    var close = function() {
      postMessage(uid, 'showNotification', false);
    }

    NotificationHelper.send(title, body, gIconUrl, success, close);
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
      case 'showNotification':
        args.unshift(uid);
        showNotification.apply(this, args);
        break;
      case 'showApp':
        displayHeaderInFrontEnd.apply(this, args);
        break;
    }
  }

  return {
    process: process
  }
})();


})();

// XXX Let's start the network a bit later.
