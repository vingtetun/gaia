/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var URL = {
  _a: document.createElement('a'),
  newURL: function url_newURL(spec) {
    var a = this._a;
    a.href = spec;
    
    return {
      'protocol': a.protocol,
      'host': a.host,
      'hostname': a.hostname,
      'port': a.port,
      'pathname': a.pathname,
      'search': a.search,
      'hash': a.hash,
      'equals': function url_equals(url) {
        return this.protocol == url.protocol &&
               this.host == url.host &&
               this.port == url.port &&
               this.pathname == url.pathname;
      }
    }
  }
};

if (!window['Gaia'])
  var Gaia = {};

(function() {

  Gaia.AppManager = {
    // Return true iff the strings u1 and u2 are equal up the first
    // occurrence of '?', which is assumed to be the start of a URL
    // query string and ignored.
    _urlsEqualToQueryString: function GAM_urlsEqualToQueryString(u1, u2) {
      var url = URL.newURL(u1);
      return url.equals(URL.newURL(u2));
    },

    _appIdCounter: 0,

    _foregroundWindows: [],

    set foregroundWindow(win) {
      this._foregroundWindows.push(win);
    },

    get foregroundWindow() {
      var foregroundWindows = this._foregroundWindows;
      var count = foregroundWindows.length;
      for (var i = count; i > 0; i--) {
        if (foregroundWindows[i - 1].hasAttribute('hidden'))
          foregroundWindows.pop();
      }

      count = foregroundWindows.length;
      if (!count)
        return null;

      return foregroundWindows[count - 1];
    },

    _runningApps: [],

    get runningApps() {
      return this._runningApps;
    },

    get screen() {
      delete this.screen;
      return this.screen = document.getElementById('screen');
    },

    get windowsContainer() {
      delete this.windowsContainer;

      var element = document.getElementById('windows');
      element.show = function() {
        element.classList.add('active');
      };
      element.hide = function() {
        element.classList.remove('active');
      };
      element.createWindow = (function(app) {
        var documentElement = document.documentElement;
        var iframe = document.createElement('iframe');
        var id = this._appIdCounter++;
        var url = app.url;
        iframe.className = 'appWindow';
        iframe.src = url;
        iframe.id = 'app_' + id;
        iframe.style.width = documentElement.clientWidth + 'px';
        iframe.style.height = documentElement.clientHeight - 37 + 'px';
        iframe.taskElement = Gaia.TaskManager.add(app, id);
        element.appendChild(iframe);
        return iframe;
      }).bind(this);
      return this.windowsContainer = element;
    },

    init: function() {
      window.addEventListener('home', this);
      window.addEventListener('message', this);

      this._closeButtonImage = new Image();
      this._closeButtonImage.src = 'style/images/close.png';
    },

    handleEvent: function(evt) {
      switch (evt.type) {
        case 'message':
          if (evt.data != 'appclose')
            return;
          this.close();
          break;
        case 'home':
          this.close();
          break;
        default:
          throw new Error('Unhandled event in AppManager');
          break;
      }
    },

    installedApps: [],

    getInstalledApps: function(callback) {
      var location = document.location.toString().replace(/[a-zA-Z.0-9]+$/, '');
      var homescreenOrigin = URL.newURL(location);

      var self = this;
      window.navigator.mozApps.enumerateAll(function enumerateApps(apps) {
        var cache = [];
        apps.forEach(function(app) {
          var manifest = app.manifest;
          if (homescreenOrigin.equals(URL.newURL(app.origin)))
            return;

          var icon = manifest.icons ? app.origin + manifest.icons['120'] : '';
          // Even if the icon is stored by the offline cache, trying to load it
          // will fail because the cache is used only when the application is
          // opened.
          // So when an application is installed it's icon is inserted into
          // the offline storage database - and retrieved later when the
          // homescreen is used offline. (TODO)
          // So we try to look inside the database for the icon and if it's
          // empty an icon is loaded by the homescreen - this is the case
          // of pre-installed apps that does not have any icons defined
          // in offline storage.
          if (icon && !window.localStorage.getItem(icon))
            icon =location + manifest.icons['120'];

          var url = app.origin + manifest.launch_path;
          cache.push({
            name: manifest.name,
            url: url,
            icon: icon
          });
        });

        self.installedApps = cache;
        callback(cache);
      });
    },

    getInstalledAppForURL: function(url) {
      var installedApps = this.installedApps;
      for (var i = 0; i < installedApps.length; i++) {
        var installedApp = installedApps[i];
        if (this._urlsEqualToQueryString(installedApp.url, url))
          return installedApp;
      }

      return null;
    },

    getAppInstance: function(url) {
      var runningApps = this._runningApps;
      for (var i = 0; i < runningApps.length; i++) {
        var runningApp = runningApps[i];
        if (this._urlsEqualToQueryString(runningApp.url, url))
          return runningApp;
      }
      return null;
    },

    getAppInstanceForWindow: function amGetAppInstanceForWindow(window) {
      var runningApps = this._runningApps;
      for (var i = 0; i < runningApps.length; i++) {
        var runningApp = runningApps[i];
        if (runningApp.window == window)
          return runningApp;
      }
      return null;
    },

    launch: function(url) {
      var windowsContainer = this.windowsContainer;
      windowsContainer.show();

      var instance = this.getAppInstance(url);
      var state = {
        message: 'visibilitychange',
        url: url,
        hidden: false
      };

      // App is already running, set focus to the existing instance.
      if (instance) {
        var foregroundWindow = this.foregroundWindow = instance.window;
        foregroundWindow.contentWindow.postMessage(state, '*');
        Gaia.TaskManager.sendToFront(instance.id);
      } else {
        var app = this.getInstalledAppForURL(url);
        var newWindow = windowsContainer.createWindow(app);
        var foregroundWindow = this.foregroundWindow = newWindow;

        var contentWindow = foregroundWindow.contentWindow;
        contentWindow.addEventListener('load', function appload(evt) {
          this.removeEventListener('load', appload, true);
          this.postMessage(state, '*');
        }, true);

        var taskElement = foregroundWindow.taskElement;
        taskElement.addEventListener('click', (function taskClickHandler(evt) {
          Gaia.TaskManager.setActive(false);
          window.setTimeout(function launchApp(self) {
            self.launch(url);
          }, 50, this);
        }).bind(this));

        this._runningApps.push({
          name: app.name,
          id: this._appIdCounter - 1,
          url: url,
          window: foregroundWindow
        });
      }

      var transitionHandler = function() {
        foregroundWindow.removeEventListener('transitionend',
                                             transitionHandler);
        foregroundWindow.focus();

        var name = instance ? instance.name : app.name;
        var openEvent = document.createEvent('CustomEvent');
        openEvent.initCustomEvent('appopen', true, true, name);
        window.dispatchEvent(openEvent);
      };

      foregroundWindow.addEventListener('transitionend', transitionHandler);
      window.setTimeout(function showWindow() {
        foregroundWindow.classList.add('active');
      }, 50);

      return foregroundWindow;
    },

    close: function() {
      var foregroundWindow = this.foregroundWindow;

      if (!foregroundWindow)
        return;

      var windowsContainer = this.windowsContainer;

      var instance = this.getAppInstanceForWindow(foregroundWindow);
      var state = {
        message: 'visibilitychange',
        url: instance.url,
        hidden: true
      };

      var transitionHandler = function() {
        foregroundWindow.removeEventListener('transitionend',
                                             transitionHandler);
        foregroundWindow.blur();
        foregroundWindow.contentWindow.postMessage(state, '*');
        windowsContainer.hide();
        window.focus();

        var closeEvent = document.createEvent('CustomEvent');
        closeEvent.initCustomEvent('appclose', true, true, instance.name);
        window.dispatchEvent(closeEvent);
      };

      foregroundWindow.addEventListener('transitionend', transitionHandler);
      foregroundWindow.classList.remove('active');
    },

    kill: function(url) {
      var runningApps = this._runningApps;
      for (var i = 0; i < runningApps.length; i++) {
        if (runningApps[i].url === url) {
          this.windowsContainer.removeChild(runningApps[i].window);
          runningApps.splice(i, 1);
          break;
        }
      }
    }
  };

})();

