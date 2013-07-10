/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var ApplicationsList = {
  _apps: [],
  _displayedApp: null,

  _permissionsTable: null,

  container: document.querySelector('#appPermissions > div > ul'),
  detailPermissionsList: document.querySelector('#permissionsListHeader + ul'),

  bookmarksClear: {
    dialog: document.querySelector('#appPermissions .cb-alert'),
    goButton: document.querySelector('#appPermissions .cb-alert-clear'),
    cancelButton: document.querySelector('#appPermissions .cb-alert-cancel'),
    mainButton: document.getElementById('clear-bookmarks-app')
  },

  init: function al_init() {
    var appsMgmt = navigator.mozApps.mgmt;
    appsMgmt.oninstall = this.oninstall.bind(this);
    appsMgmt.onuninstall = this.onuninstall.bind(this);
    this.container.addEventListener('click', this);
    // load the permission table
    var self = this;
    loadJSON('/resources/permissions_table.json', function loadPermTable(data) {
      self._permissionsTable = data;
      self.initExplicitPermissionsTable();
    });

    // Implement clear bookmarks apps button and its confirm dialog
    var confirmDialog = this.bookmarksClear.dialog;
    this.bookmarksClear.goButton.onclick = function cb_confirmGoClicked(event) {
      var settings = navigator.mozSettings;
      var lock = settings.createLock();
      lock.set({'clear.remote-windows.data': true});

      confirmDialog.hidden = true;
    };

    this.bookmarksClear.cancelButton.onclick =
      function cb_confirmCancelClicked(event) {
        confirmDialog.hidden = true;
      };

    this.bookmarksClear.mainButton.onclick = function clearBookmarksData() {
      confirmDialog.hidden = false;
    };
  },

  initExplicitPermissionsTable: function al_initExplicitPermissionsTable() {
    var self = this;

    var table = this._permissionsTable;
    table.explicitCertifiedPermissions = [];

    var mozPerms = navigator.mozPermissionSettings;

    // we need _any_ certified app in order to build the
    // explicitCertifiedPermissions list so we use the Settings app itself.
    window.navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
      var app = evt.target.result;

      table.plainPermissions.forEach(function permIterator(perm) {
        var isExplicit = mozPerms.isExplicit(perm, app.manifestURL,
                                             app.origin, false);
        if (isExplicit) {
          table.explicitCertifiedPermissions.push(perm);
        }
      });

      table.composedPermissions.forEach(function permIterator(perm) {
        table.accessModes.some(function modeIterator(mode) {
          var composedPerm = perm + '-' + mode;
          var isExplicit = mozPerms.isExplicit(composedPerm, app.manifestURL,
                                               app.origin, false);
          if (isExplicit) {
            table.explicitCertifiedPermissions.push(composedPerm);
          }
        });
      });

      // then load the apps
      self.loadApps();
    };
  },

  handleEvent: function al_handleEvent(evt) {
    var appIndex = evt.target.dataset.appIndex;
    if (appIndex) {
      window.open('app-permissions-detail.html#'+appIndex);
      return;
    }
  },

  loadApps: function al_loadApps() {
    var self = this;
    var table = this._permissionsTable;
    var mozPerms = navigator.mozPermissionSettings;

    navigator.mozApps.mgmt.getAll().onsuccess = function mozAppGotAll(evt) {
      var apps = evt.target.result;

      apps.forEach(function(app) {
        if (HIDDEN_APPS.indexOf(app.manifestURL) != -1)
          return;

        var manifest = app.manifest ? app.manifest : app.updateManifest;
        if (manifest.type != 'certified') {
          self._apps.push(app);
          return;
        }

        var display = table.explicitCertifiedPermissions.
                            some(function iterator(perm) {
          var permInfo = mozPerms.get(perm, app.manifestURL, app.origin, false);
          return permInfo != 'unknown';
        });

        if (display) {
          self._apps.push(app);
        }
      });

      self._sortApps();
      self.render();
    };
  },

  render: function al_render() {
    this.container.innerHTML = '';

    var listFragment = document.createDocumentFragment();
    this._apps.forEach(function appIterator(app, index) {
      var icon = null;
      var manifest = new ManifestHelper(app.manifest ?
          app.manifest : app.updateManifest);
      if (manifest.icons &&
          Object.keys(manifest.icons).length) {

        var key = Object.keys(manifest.icons)[0];
        var iconURL = manifest.icons[key];

        // Adding origin if it is a relative URL
        if (!(/^(http|https|data):/.test(iconURL))) {
          iconURL = app.origin + '/' + iconURL;
        }

        icon = document.createElement('img');
        icon.src = iconURL;
      } else {
        icon = document.createElement('img');
        icon.src = '../style/images/default.png';
      }

      var item = document.createElement('li');

      var link = document.createElement('a');
      link.href = '#appPermissions-details';
      if (icon) {
        link.appendChild(icon);
      }
      var name = document.createTextNode(manifest.name);
      link.appendChild(name);
      link.dataset.appIndex = index;

      item.appendChild(link);

      listFragment.appendChild(item);
    }, this);

    this.container.appendChild(listFragment);

    // Unhide clear bookmarks button only after app list is populated
    // otherwise it would appear solely during loading
    this.bookmarksClear.mainButton.style.visibility = '';
  },

  oninstall: function al_oninstall(evt) {
    var app = evt.application;

    this._apps.push(app);
    this._sortApps();

    this.render();
  },

  onuninstall: function al_onuninstall(evt) {
    var app;
    var appIndex;
    this._apps.some(function findApp(anApp, index) {
      if (anApp.origin === evt.application.origin) {
        app = anApp;
        appIndex = index;
        return true;
      }
      return false;
    });

    if (!app)
      return;

    this._apps.splice(appIndex, 1);

    this.render();
  },

  _sortApps: function al_sortApps() {
    this._apps.sort(function alphabeticalSort(app, otherApp) {
      var manifest = new ManifestHelper(app.manifest ?
        app.manifest : app.updateManifest);
      var otherManifest = new ManifestHelper(otherApp.manifest ?
        otherApp.manifest : otherApp.updateManifest);
      return manifest.name > otherManifest.name;
    });
  }
};

navigator.mozL10n.ready(ApplicationsList.init.bind(ApplicationsList));

