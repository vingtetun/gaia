
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
        setHomescreen(this.result['homescreen.manifestURL']);
        openHomescreen();
        showHomescreen();
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }

      setting.onerror = function errorRetrievingHomescreenURL() {
        window.dispatchEvent(new CustomEvent('homescreen-ready'));
      }
    },
    goBack: function() {
      navigate[current].free();
      current--;
      declareSheetAsCurrent(navigate[current], false);
    },

    goNext: function() {
      navigate[current].free();
      current++;
      declareSheetAsCurrent(navigate[current], true);
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
        if (navigate[i].wrapper == this.wrapper) {
          navigate = navigate.slice(i, i + 1);
          break;
        }
      }
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

    var currentHistory = navigate[current];
    if (currentHistory) {
      // If someone try to open the application but it is already opened lets
      // not do it and close the homescreen.
      if (!origin) {
        if (currentHistory.isHomescreen) {
          var previousHistory = navigate[current - 1];
          if (previousHistory && previousHistory.iframe.getAttribute('mozapp') == manifestURL) {
            current--;
            declareSheetAsCurrent(previousHistory, false);
            return;
          }
        } else {
          if (currentHistory && currentHistory.iframe.getAttribute('mozapp') == manifestURL) {
            return;
          }
        }
      }

      currentHistory.free();
      for (var i = navigate.length - 1; i > current; i--) {
        var next = navigate.pop();
        next.wrapper.parentNode.removeChild(next.wrapper);
        next.close();
      }
    }

    if (currentHistory.isHomescreen == false)
      current++;

    navigate[current] = new History(origin || app.origin + app.manifest.launch_path,
                                    app.manifest.type || 'hosted');

    if (iframe) {
      appendIframe(iframe, navigate[current]);
    } else {
      createWindow(navigate[current], app.manifestURL);
    }

    declareSheetAsCurrent(navigate[current], true);
  }

  function openOrigin(origin, iframe) {
    if (navigate[current]) {
      navigate[current].free();
      for (var i = navigate.length - 1; i > current; i--) {
        var next = navigate.pop();
        next.wrapper.parentNode.removeChild(next.wrapper);
        next.close();
      }
    }
    if (navigate[current].isHomescreen == false)
      current++;

    navigate[current] = new History(origin, 'remote');

    if (iframe) {
      appendIframe(iframe, navigate[current]);
    } else {
      createWindow(navigate[current]);
    }

    declareSheetAsCurrent(navigate[current], true);
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

    var wrapper = wrap(iframe)
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


  /* Homescreen */
  var homescreenManifestURL = null;

  function setHomescreen(manifestURL) {
    homescreenManifestURL = manifestURL;
  }

  function isHomescreen(manifestURL) {
    return manifestURL == homescreenManifestURL;
  }

  var homescreenHistory = null;
  function openHomescreen() {
    var app = Applications.getByManifestURL(homescreenManifestURL);
    if (!app)
      return;

    var iframe = document.createElement('iframe');
    iframe.setAttribute('mozbrowser', 'true');
    iframe.setAttribute('remote', 'true');
    iframe.setAttribute('mozapp', homescreenManifestURL);
    iframe.setAttribute('mozapptype', 'homescreen');

    homescreenHistory = new History(app.origin + app.manifest.launch_path,
                                    app.manifest.type);
    homescreenHistory.isHomescreen = true;

    var wrapper = wrap(iframe);
    wrapper.dataset.type = 'homescreen';

    document.body.appendChild(wrapper);
    iframe.src = homescreenHistory.location;
    homescreenHistory.attach(wrapper, iframe);
  }

  function showHomescreen() {
    if (navigate[current] == homescreenHistory)
      return;

    if (navigate[current]) {
      navigate[current].free();
      for (var i = navigate.length - 1; i > current; i--) {
        var next = navigate.pop();

        if (next.isHomescreen)
          continue;
        next.wrapper.parentNode.removeChild(next.wrapper);
        next.close();
      }
    }

    current++;
    navigate[current] = homescreenHistory;
    declareSheetAsCurrent(homescreenHistory, true);
  }

  window.addEventListener('home', function onHomeButton(e) {
    e.preventDefault();
    showHomescreen();
    Rocketbar.close(true);
  }, true);

  return obj;
})();

function declareSheetAsCurrent(history, forward) {
  var evt = new CustomEvent('historychange', {
    bubbles: true,
    detail: {
      current: history,
      forward: forward
    }
  });

  history.wakeUp();

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

  this.wrapper = null;
  this.iframe = null;

  this._awake = true;
}

History.prototype = {
  attach: function history_attach(wrapper, iframe) {
    this.wrapper = wrapper;
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

    this.wrapper = null;
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
        if (this.wrapper.dataset.current) {
          WindowManager.goBack();
        }
        WindowManager.evictEntry(this);
        this.wrapper.parentNode.removeChild(this.wrapper);
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

    this._awake = false;
    if (!this.wrapper || !this.iframe) {
      return;
    }

    var iframe = this.iframe;
    var cover = this.wrapper.querySelector('.cover');

    var screenshotAndHide = (function() {
      var req = iframe.getScreenshot(window.innerWidth, window.innerHeight);
      var afterScreenshot = (function(e) {
        if (e.target.result) {
          cover.style.display = 'block';
          cover.style.backgroundImage = 'url(' + URL.createObjectURL(e.target.result) + ')';
        }

        if ('setVisible' in iframe) {
          iframe.setVisible(false);
        }

        // Wow, the window was awaken while we were screenshoting
        if (this._awake) {
          this.wakeUp();
        }
      }).bind(this);

      req.onsuccess = afterScreenshot;
      req.onerror = afterScreenshot;
    }).bind(this);

    // Making sure we don't let the iframe in a keyboard state
    // while screenshoting
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

  wakeUp: function history_wakeUp() {
    this._awake = true;

    var iframe = this.iframe;
    if ('setVisible' in iframe) {
      iframe.setVisible(true);
    }

    if (!('addNextPaintListener' in iframe)) {
      return;
    }

    var cover = this.wrapper.querySelector('.cover');
    iframe.addNextPaintListener(function paintWait() {
      iframe.removeNextPaintListener(paintWait);

      setTimeout(function bitLater() {
        cover.style.display = '';
        cover.style.backgroundImage = '';
      }, 250);
    });
  },

  ontitlechange: null,
  onlocationchange: null,
  onstatuschange: null,
  oncangoback: null,
  oncangoforward: null
};

