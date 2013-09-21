
var WindowManager = (function() {
  'use strict';

  function debug(str) {
    dump('WindowManager: ' + str + '\n');
  }

  var obj = {
    launch: function() {
      debug('Someone call launch: ' + arguments);
    },

    kill: function(url) {
      debug('Someone call kill: ' + arguments);

      var previousHistory = GroupedNavigation.getSheet(current);
      current = GroupedNavigation.removeGroup(current, url);
      var newHistory = GroupedNavigation.getSheet(current);
      if (newHistory != previousHistory) {
        declareSheetAsCurrent(newHistory, true, true);
      }
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

    openHomescreen: function() {
      openHomescreen();
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
        setHomescreen(this.result['homescreen.manifestURL']);
        openHomescreen();
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }

      setting.onerror = function errorRetrievingHomescreenURL() {
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }

      // Tell to RIL that we are ready to receive messages.
      var evt = new CustomEvent('mozContentEvent', {
        bubbles: true, cancelable: false,
        detail: { type: 'system-message-listener-ready' } });
      window.dispatchEvent(evt);
    },

    goBack: function() {
      current--;
      declareSheetAsCurrent(GroupedNavigation.getSheet(current), false);
    },

    goNext: function() {
      current++;
      declareSheetAsCurrent(GroupedNavigation.getSheet(current), true);
    },

    goLast: function() {
      debug("goLast: " + current);
      GroupedNavigation._debug();
      declareSheetAsCurrent(GroupedNavigation.getSheet(current), true);
    },

    getPrevious: function() {
      return GroupedNavigation.getSheet(current - 1);
    },

    getNext: function() {
      return GroupedNavigation.getSheet(current + 1);
    },

    getCurrent: function() {
      return GroupedNavigation.getSheet(current);
    },

    evictEntry: function(history) {
      debug("evictEntry: " + current);
      GroupedNavigation._debug();

      var previousCurrent = current;
      current = GroupedNavigation.evictSheet(current, history);
      var newHistory = GroupedNavigation.getSheet(current);
      declareSheetAsCurrent(newHistory, true);
    },

    resizeCurrentSheet: function(width, height) {
      debug('resizing current: ' + width + ' x ' + height + '\n');

      var iframe = this.getCurrent().iframe;
      iframe.style.height = height + 'px';
      iframe.style.width = width + 'px';
    },

    openNewSheet: function(origin, manifestURL) {
      debug("open " + origin + " for " + manifestURL + "\n");

      // If the link will target a different domain let's open it a a normal remote link
      if (manifestURL) {
        var urlHelper = document.createElement('a');
        urlHelper.href = origin;

        var urlHelper2 = document.createElement('a');
        urlHelper2.href = manifestURL;

        if (urlHelper.host != urlHelper2.host || urlHelper.protocol != urlHelper2.protocol) {
          manifestURL = '';
        }
      }

      if (manifestURL) {
        openApp(manifestURL, origin);
      } else {
        openOrigin(origin);
      }
    }
  }

  /* XXX */
  var navigate = [];
  var current = 0;

  function openApp(manifestURL, origin, iframe) {
    var app = Applications.getByManifestURL(manifestURL);
    if (!app)
      return;

    if (!iframe) {
      var bringBackCurrent = GroupedNavigation.requestApp(current, manifestURL);
      if (bringBackCurrent != -1) {
        current = bringBackCurrent;
        var appHistory = GroupedNavigation.getSheet(current);
        declareSheetAsCurrent(appHistory, true);
        return;
      }
    }

    var manifest = app.manifest;
    var entryPoints = manifest.entry_points;
    if (entryPoints) {
      for (var ep in entryPoints) {
        var currentEp = entryPoints[ep];
        var path = origin;
        if (path.indexOf('?') != -1) {
          path = path.substr(0, path.indexOf('?'));
        }

        //Remove the origin and / to find if if the url is the entry point
        if (path.indexOf('/' + ep) == 0 &&
            (currentEp.launch_path == path)) {
          origin = origin + currentEp.launch_path;
        }
      }
    }

    var newHistory = new History(origin || app.origin + app.manifest.launch_path,
                                    app.manifest.type || 'hosted');

    if (manifestURL == homescreenManifestURL) {
      newHistory.isHomescreen = true;
      homescreenHistory = newHistory;
    }

    current = GroupedNavigation.insertSheet(current, app.manifestURL, newHistory);

    if (iframe) {
      appendIframe(iframe, newHistory);
    } else {
      createWindow(newHistory, app.manifestURL);
    }

    declareSheetAsCurrent(newHistory, true);
  }

  function openOrigin(origin, iframe) {
    var newHistory = new History(origin, 'remote');
    current = GroupedNavigation.insertSheet(current, origin, newHistory);

    if (iframe) {
      appendIframe(iframe, newHistory);
    } else {
      createWindow(newHistory);
    }

    declareSheetAsCurrent(newHistory, true);
  }

  function createWindow(history, manifestURL) {
    var iframe = document.createElement('iframe');

    iframe.setAttribute('mozbrowser', 'true');
    // XXX Disabled on desktop
    iframe.setAttribute('remote', 'true');

    if (manifestURL) {
      iframe.setAttribute('mozapp', manifestURL);
    } else {
      iframe.setAttribute('mozasyncpanzoom', 'true');
    }

    var wrapper = wrap(iframe);
    appendWindow(wrapper);

    iframe.src = history.location;
    history.attach(wrapper, iframe);
  }

  function wrap(iframe) {
    var wrapper = document.createElement('div');
    wrapper.className = 'window-wrapper';

    wrapper.appendChild(iframe);

    var cover = document.createElement('div');
    cover.className = 'cover';
    wrapper.appendChild(cover);

    var backButton = document.createElement('button');
    backButton.classList.add('back');
    backButton.textContent = '←';
    wrapper.appendChild(backButton);

    var forwardButton = document.createElement('button');
    forwardButton.classList.add('forward');
    forwardButton.textContent = '→';
    wrapper.appendChild(forwardButton);

    return wrapper;
  }

  function appendIframe(iframe, history) {
    var wrapper = wrap(iframe);
    appendWindow(wrapper);
    history.attach(wrapper, iframe);
  }

  function appendWindow(wrapper) {
    var windows = document.getElementById('windows');
    windows.insertBefore(wrapper, null); //document.querySelector('[mozapptype=homescreen]'));
  }

  window.addEventListener('mozbrowseropenwindow', function onWindowOpen(e) {
    var origin = e.detail.url;

    var frame = e.detail.frameElement;

    if (origin === 'about:blank') {
      PagesIntro.show();
    }

    if (frame.hasAttribute('mozapp') && (origin.indexOf('app://') != -1)) {
      openApp(frame.getAttribute('mozapp'), origin, frame);
    } else {
      openOrigin(origin, frame);
    }
    e.preventDefault();
  });

  window.addEventListener('mozChromeEvent', function onChromeEvent(e) {
    if (e.detail.type != 'webapps-launch')
      return;
    openApp(e.detail.manifestURL, e.detail.url);
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


  /* Homescreen */
  var homescreenManifestURL = null;
  var homescreenHistory = null;

  function setHomescreen(manifestURL) {
    homescreenManifestURL = manifestURL;
  }

  function isHomescreen(manifestURL) {
    return manifestURL == homescreenManifestURL;
  }

  function openHomescreen(force) {
    var currentHistory = GroupedNavigation.getSheet(current);
    if (currentHistory && currentHistory.isHomescreen) {
      return;
    }

    if (homescreenHistory) {
      current = GroupedNavigation.insertSheet(current, homescreenManifestURL,
                                              homescreenHistory);
      declareSheetAsCurrent(homescreenHistory, true);
      return;
    }

    openApp(homescreenManifestURL);
  }

  window.addEventListener('home', function onHomeButton(e) {
    e.preventDefault();
    openHomescreen();
    Rocketbar.close(true);
  }, true);

  window.addEventListener('sheetschanged', function onSheetsChanged(e) {
    var prev = e.detail.previous;
    var cur = e.detail.current;
    var statusbar = document.getElementById('statusbar');

    statusbar.classList[cur.isHomescreen ? 'add' : 'remove']('displayed');

    if (prev) {
      if (prev.isHomescreen) {
        current = GroupedNavigation.removeGroup(current, homescreenManifestURL);
        return;
      }
      prev.free();
    }

    if (cur) {
      cur.wakeUp();
    }
  });

  return obj;
})();

function declareSheetAsCurrent(history, forward, removing) {
  if (!history) {
    WindowManager.openHomescreen();
    return;
  }

  if (history.location === 'about:blank') {
    PagesIntro.show();
  }
  var evt = new CustomEvent('historychange', {
    bubbles: true,
    detail: {
      current: history,
      forward: forward,
      removing: removing
    }
  });

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
  this.isHomescreen = false;
  this.isApp = (origin.indexOf('app://') != -1);
  this.painted = false;

  this.wrapper = null;
  this.iframe = null;
  this.cover = null;

  this._awake = true;
  this._screenshotCached = false;
  this._screenshotInvalidationID = null;
}

History.prototype = {
  attach: function history_attach(wrapper, iframe) {
    this.wrapper = wrapper;
    this.iframe = iframe;
    this.cover = wrapper.querySelector('.cover');

    iframe.addEventListener('mozbrowsertitlechange', this);
    iframe.addEventListener('mozbrowserlocationchange', this);
    iframe.addEventListener('mozbrowserloadstart', this);
    iframe.addEventListener('mozbrowserloadend', this);
    iframe.addEventListener('mozbrowserclose', this);
    iframe.addEventListener('mozbrowsererror', this);
    iframe.addEventListener('mozbrowserfirstpaint', this);
  },

  detach: function history_detach(iframe) {
    iframe.removeEventListener('mozbrowsertitlechange', this);
    iframe.removeEventListener('mozbrowserlocationchange', this);
    iframe.removeEventListener('mozbrowserloadstart', this);
    iframe.removeEventListener('mozbrowserloadend', this);
    iframe.removeEventListener('mozbrowserclose', this);
    iframe.removeEventListener('mozbrowsererror', this);
    iframe.removeEventListener('mozbrowserfirstpaint', this);

    this.wrapper = null;
    this.iframe = null;
    this.cover = null;
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
        this.painted = false;

        if (this.location !== 'about:blank') {
          PagesIntro.hide();
        }

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

      case 'firstpaint':
        this.painted = true;

        if (this.onfirstpaint) {
          this.onfirstpaint();
        }
        break;

      case 'close':
      case 'error':
        // XXX This is a bit rude with error but that's ok for now
        WindowManager.evictEntry(this);
        var wrapper = this.wrapper.parentNode.removeChild(this.wrapper);
        this.free();
        this.close();
        break;

      default:
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
    this.onfirstpaint = null;

    this._awake = false;
    if (!this.wrapper || !this.iframe) {
      return;
    }

    if (this._screenshotInvalidationID) {
      clearTimeout(this._screenshotInvalidationID);
      this._screenshotInvalidationID = null;
    }

    var iframe = this.iframe;

    // Making sure we don't let the iframe in a keyboard state
    // while screenshoting
    var screenshotAndHide = this._screenshotAndHide.bind(this);
    if (iframe.style.height) {
      iframe.style.height = '';
      iframe.addNextPaintListener(function paintWait() {
        iframe.removeNextPaintListener(paintWait);
        screenshotAndHide();
      });
      return;
    }

    screenshotAndHide();
  },

  _screenshotAndHide: function history_screenshotAndHide() {
    if (this._screenshotCached) {
      this._swapWithCover();
      return;
    }

    this._afterScreenshot(this._swapWithCover.bind(this));
  },

  _swapWithCover: function history_swapWithCover() {
    if (!this.cover) {
      return;
    }

    var iframe = this.iframe;

    this.cover.style.display = 'block';
    if ('setVisible' in iframe) {
      iframe.setVisible(false);
    }

    if (this._awake) {
      this.wakeUp();
    }
  },

  wakeUp: function history_wakeUp() {
    this._awake = true;

    var iframe = this.iframe;
    if ('setVisible' in iframe) {
      iframe.setVisible(true);
    }

    if (!('getScreenshot' in iframe)) {
      this._swapWithFrame();
      return;
    }

    // We get a screenshot here to fore compositing
    this._afterScreenshot(this._swapWithFrame.bind(this));
  },

  _swapWithFrame: function history_swapWithFrame() {
    this.cover.style.display = '';

    if (!this._awake) {
      this.free();
      return;
    }

    // We invalidate the screenshot only if the sheet gets repainted
    var self = this;
    self.iframe.addNextPaintListener(function paintWait() {
      self.iframe.removeNextPaintListener(paintWait);
      self._screenshotCached = false;
    });
  },

  _afterScreenshot: function history_afterScreenshot(callback) {
    var req = this.iframe.getScreenshot(window.innerWidth, window.innerHeight);
    var afterScreenshot = (function(e) {
      if (e.target.result) {
        this.cover.style.backgroundImage = 'url(' + URL.createObjectURL(e.target.result) + ')';
        this._screenshotCached = true;
      } else {
        if (this.cover) {
          this.cover.style.backgroundImage = '';
        }
        this._screenshotCached = false;
      }

      if (callback && typeof(callback) == 'function') {
        callback();
      }
    }).bind(this);

    req.onsuccess = afterScreenshot;
    req.onerror = afterScreenshot;
  },

  ontitlechange: null,
  onlocationchange: null,
  onstatuschange: null,
  oncangoback: null,
  oncangoforward: null,
  onfirstpaint: null
};

