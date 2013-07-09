
var WindowManager = (function() {
  'use strict';

  function debug(str) {
    dump('WindowManager: ' + str + '\n');
  }

  var obj = {
    launch: function() {
      debug('Someone call launch: ' + arguments);
    },

    kill: function() {
      debug('Someone call kill: ' + arguments);
    },

    reload: function() {
      debug('Someone call reload: ' + arguments);
    }, 

    getDisplayedApp: function() {
      debug('Someone call getDisplayedApp: ' + arguments);
    },

    setOrientationForApp: function() {
      debug('Someone call setOrientationForApp: ' + arguments);
    },

    getAppFrame: function() {
      debug('Someone call getAppFrame: ' + arguments);
    },

    getRunningApps: function() {
      debug('Someone call getRunningApps: ' + arguments);
    },

    setDisplayedApp: function() {
      debug('Someone call getRunningApps: ' + arguments);
    },

    getCurrentDisplayedApp: function() {
      debug('Someone call getCurrentDisplayedApp: ' + arguments);
    },

    getOrientationForApp: function() {
      debug('Someone call getOrientationForApp: ' + arguments);
    },

    toggleHomescreen: function() {
      debug('Someone call toggleHomescreen: ' + arguments);
    },


    retrieveHomescreen: function(callback) {
      debug('Someone call retrieveHomescreen: ' + arguments);
    },

    get screenshots() {
      debug('Someone call getScreenshot: ' + arguments);
    },

    start: function() {
      var lock = navigator.mozSettings.createLock();
      var setting = lock.get('homescreen.manifestURL');

      setting.onsuccess = function successRetrievingHomescreenURL() {
        homescreenManifestURL = this.result['homescreen.manifestURL'];
        openApp(homescreenManifestURL);
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }

      setting.onerror = function errorRetrievingHomescreenURL() {
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }
    },
    goBack: function(partial) {
      current--;
      declareSheetAsCurrent(navigate[current], false, partial);
    },

    goNext: function(partial) {
      current++;
      declareSheetAsCurrent(navigate[current], true, partial);
    },

    getPrevious: function() {
      return navigate[current - 1];
    },

    getNext: function() {
      return navigate[current + 1];
    },

    getCurrent: function() {
      return navigate[current];
    },

    evictEntry: function(history) {
      for (var i in navigate) {
        if (navigate[i].iframe == this.iframe) {
          navigate = navigate.slice(i, i + 1);
          break;
        }
      }
    }
  }

  /* XXX */
  var homescreenManifestURL = null;
  var navigate = [];
  var current = 0;

  function openApp(manifestURL, origin, iframe) {
    var app = Applications.getByManifestURL(manifestURL);
    if (!app)
      return;

    if (navigate[current]) {
      navigate[current].free();
      for (var i = navigate.length - 1; i > current; i--) {
        var next = navigate.pop();
        next.iframe.parentNode.removeChild(next.iframe);
        next.close();
      }
    }
    current++;

    navigate[current] = new History(origin || app.origin + app.manifest.launch_path,
                                    app.manifest.type || 'hosted');

    if (iframe) {
      appendIframe(iframe);
      navigate[current].attach(iframe);
    } else {
      createIframe(navigate[current], app.manifestURL);
    }

    declareSheetAsCurrent(navigate[current], true);
  }

  function openOrigin(origin, iframe) {
    if (navigate[current]) {
      navigate[current].free();
      for (var i = navigate.length - 1; i > current; i--) {
        var next = navigate.pop();
        next.iframe.parentNode.removeChild(next.iframe);
        next.close();
      }
    }
    current++;

    navigate[current] = new History(origin, 'remote');

    if (iframe) {
      appendIframe(iframe);
      navigate[current].attach(iframe);
    } else {
      createIframe(navigate[current]);
    }

    declareSheetAsCurrent(navigate[current], true);
  }

  function openHomescreen() {
    openApp(Applications.getByManifestURL(homescreenManifestURL));
  }

  function createIframe(history, manifestURL) {
    var iframe = document.createElement('iframe');

    iframe.setAttribute('mozbrowser', 'true');
    // XXX Disabled on desktop
    iframe.setAttribute('remote', 'true');

    if (manifestURL) {
      iframe.setAttribute('mozapp', manifestURL);
      if (manifestURL == homescreenManifestURL) {
        iframe.setAttribute('mozapptype', 'homescreen');
      }
    } else {
      iframe.setAttribute('mozasyncpanzoom', 'true');
    }

    appendIframe(iframe);
    iframe.src = history.location;
    history.attach(iframe);
  }

  function appendIframe(iframe) {
    var windows = document.getElementById('windows');
    windows.appendChild(iframe);
  }

  window.addEventListener('mozbrowseropenwindow', function onWindowOpen(e) {
    var origin = e.detail.url;

    var frame = e.detail.frameElement;
    if (frame.hasAttribute('mozapp')) {
      openApp(frame.getAttribute('mozapp'), origin, frame);
    } else {
      openOrigin(origin, frame);
    }
    e.preventDefault();
  });

  window.addEventListener('mozChromeEvent', function onChromeEvent(e) {
    if (e.detail.type != 'webapps-launch')
      return;
    openApp(e.detail.manifestURL);
    e.preventDefault();
  });

  window.addEventListener('mozChromeEvent', function onChromeEvent(e) {
    if (e.detail.type != 'open-app' || !e.detail.isActivity)
      return;
    openApp(e.detail.manifestURL, e.detail.url);
    e.preventDefault();
  });

  window.addEventListener('mozChromeEvent', function(e) {
    if (e.detail.type != 'activity-done')
      return;

    // Remove the top most frame every time we get an 'activity-done' event.
    WindowManager.goBack();
    e.preventDefault();
  });

  window.addEventListener('home', function onHomeButton(e) {
    if (navigate[current].iframe.getAttribute('mozapp') == homescreenManifestURL)
      return;
    openApp(homescreenManifestURL);
    e.preventDefault();
  });

  return obj;
})();

function declareSheetAsCurrent(history, forward, partial) {
  var evt = new CustomEvent('historychange', {
    bubbles: true,
    detail: {
      current: history,
      forward: forward,
      partial: !!partial
    }
  });

  var iframe = history.iframe;
  if ('setVisible' in iframe) {
    iframe.setVisible(true);
  }
  window.dispatchEvent(evt);
}

// History object are live They listen for iframes event until this one is
// close for any reasons. Then the state of the iframe is considered frozen
// and the related history entry can remove the event listener.
// A frozen history entry that is unfrozen will re-attach itself to the new iframe.
function History(origin, type) {
  this.title = '';
  this.location = origin;
  this.loading = true;
  this.canGoBack = false;
  this.canGoForward = false;
  this.type = type;

  this.iframe = null;
}

History.prototype = {
  attach: function history_attach(iframe) {
    this.iframe = iframe;

    iframe.addEventListener('mozbrowsertitlechange', this);
    iframe.addEventListener('mozbrowserlocationchange', this);
    iframe.addEventListener('mozbrowserloadstart', this);
    iframe.addEventListener('mozbrowserloadend', this);
    iframe.addEventListener('mozbrowserclose', this);
    iframe.addEventListener('mozbrowsererror', this);
  },

  detach: function history_detach(iframe) {
    iframe.removeEventListener('mozbrowsertitlechange', this);
    iframe.removeEventListener('mozbrowserlocationchange', this);
    iframe.removeEventListener('mozbrowserloadstart', this);
    iframe.removeEventListener('mozbrowserloadend', this);
    iframe.removeEventListener('mozbrowserclose', this);
    iframe.removeEventListener('mozbrowsererror', this);

    this.iframe = null;
  },

  handleEvent: function history_handleEvent(evt) {
    switch (evt.type.replace('mozbrowser', '')) {
      case 'titlechange':
        this.title = evt.detail || '';

        if (this.ontitlechange) {
          this.ontitlechange(this.title);
        }
        break;

      case 'locationchange':
        this.location = evt.detail;

        if (this.onlocationchange) {
          this.onlocationchange(this.location);
        }

        this.iframe.getCanGoBack().onsuccess = (function(e) {
          this.canGoBack = e.target.result;

          if (this.oncangoback) {
            this.oncangoback(this.canGoBack);
          }
        }).bind(this);

        this.iframe.getCanGoForward().onsuccess = (function(e) {
          this.canGoForward = e.target.result;

          if (this.oncangoforward) {
            this.oncangoforward(this.canGoForward);
          }
        }).bind(this);
        break;

      case 'loadstart':
        this.loading = true;

        if (this.onstatuschange) {
          this.onstatuschange(this.loading);
        }
        break;

      case 'loadend':
        this.loading = false;

        if (this.onstatuschange) {
          this.onstatuschange(this.loading);
        }
        break;

      case 'close':
      case 'error':
        // XXX This is a bit rude with error but that's ok for now
        if (this.iframe.dataset.current) {
          WindowManager.goBack();
        }
        WindowManager.evictEntry(this);
        this.iframe.parentNode.removeChild(this.iframe);
        this.close();
        break;
    }
  },

  close: function history_close() {
    this.detach(this.iframe);
  },

  go: function history_go(str) {
    if (!this.iframe)
      return;

    this.iframe.src = str;
  },

  goBack: function history_goBack() {
    if (!this.iframe)
      return;

    this.iframe.goBack();
  },

  goForward: function history_goForward() {
    if (!this.iframe)
      return;

    this.iframe.goForward();
  },

  reload: function history_reload() {
    if (!this.iframe)
      return;

    this.iframe.reload();
  },

  stop: function history_stop() {
    if (!this.iframe)
      return;

    this.iframe.stop();
  },

  free: function history_free() {
    this.ontitlechange = null;
    this.onlocationchange = null;
    this.onstatuschange = null;
    this.oncangoback = null;
    this.oncangoforward = null;

    // This is dirty but Etienne wants me to clean up little crap and so I
    // decide to put it under the carpet.
    var iframe = this.iframe;
    if ('setVisible' in iframe) {
      setTimeout(function() {
        iframe.setVisible(false);
      }, 1000);
    }
  },

  ontitlechange: null,
  onlocationchange: null,
  onstatuschange: null,
  oncangoback: null,
  oncangoforward: null
};

