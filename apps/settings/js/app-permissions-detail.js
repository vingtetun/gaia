'use strict';

var ApplicationsList = {

  appIndex: window.location.hash.slice(-1),

  _apps: [],
  _displayedApp: null,

  _permissionsTable: null,

  detailTitle: document.querySelector('#appPermissions-details > header > h1'),
  developerHeader: document.getElementById('developer-header'),
  developerInfos: document.getElementById('developer-infos'),
  developerName: document.querySelector('#developer-infos > a'),
  developerLink: document.querySelector('#developer-infos > small > a'),
  detailPermissionsList: document.querySelector('#permissionsListHeader + ul'),
  detailPermissionsHeader: document.getElementById('permissionsListHeader'),
  uninstallButton: document.getElementById('uninstall-app'),

  init: function al_init() {
    var appsMgmt = navigator.mozApps.mgmt;
    var self = this;
    loadJSON('/resources/permissions_table.json', function loadPermTable(data) {
      self._permissionsTable = data;
      self.initExplicitPermissionsTable();
    });
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

  loadApps: function al_loadApps() {
    console.log('loadApps');
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
      self.showAppDetails(self._apps[self.appIndex]);
    };
  },

  showAppDetails: function al_showAppDetail(app) {
    this._displayedApp = app;

    var manifest = new ManifestHelper(app.manifest ?
        app.manifest : app.updateManifest);
    var developer = manifest.developer;
    this.detailTitle.textContent = manifest.name;

    this.uninstallButton.disabled = !app.removable;

    if (!developer || !('name' in developer)) {
      this.developerInfos.hidden = true;
      this.developerHeader.hidden = true;
    } else {
      this.developerName.textContent = developer.name;
      this.developerInfos.hidden = false;
      this.developerHeader.hidden = false;
      if (!developer.url) {
        delete this.developerName.dataset.href;
        delete this.developerLink.href;
        this.developerLink.hidden = true;
      } else {
        this.developerLink.hidden = false;
        this.developerName.dataset.href = developer.url;
        this.developerLink.href = developer.url;
        this.developerLink.dataset.href = developer.url;
        this.developerLink.textContent = developer.url;
      }
    }
    this.detailPermissionsList.innerHTML = '';

    var mozPerms = navigator.mozPermissionSettings;
    if (!mozPerms)
      return;

    var table = this._permissionsTable;

    table.plainPermissions.forEach(function appIterator(perm) {
      var value = mozPerms.get(perm, app.manifestURL, app.origin, false);
      if (this._shouldDisplayPerm(app, perm, value)) {
        this._insertPermissionSelect(perm, value);
      }
    }, this);

    table.composedPermissions.forEach(function appIterator(perm) {
      var value = null;
      var display = table.accessModes.some(function modeIterator(mode) {
        var composedPerm = perm + '-' + mode;
        value = mozPerms.get(composedPerm, app.manifestURL, app.origin, false);
        if (this._shouldDisplayPerm(app, composedPerm, value)) {
          return true;
        }
        return false;
      }, this);

      if (display) {
        this._insertPermissionSelect(perm, value);
      }
    }, this);

    this.detailPermissionsHeader.hidden =
      !this.detailPermissionsList.children.length;
  },

  _shouldDisplayPerm: function al_shouldDisplayPerm(app, perm, value) {
    var mozPerms = navigator.mozPermissionSettings;
    var isExplicit = mozPerms.isExplicit(perm, app.manifestURL,
                                         app.origin, false);

    return (isExplicit && value !== 'unknown');
  },

  _insertPermissionSelect: function al_insertPermissionSelect(perm, value) {
    var _ = navigator.mozL10n.get;

    var item = document.createElement('li');
    var content = document.createElement('span');
    var contentL10nId = 'perm-' + perm.replace(':', '-');
    content.textContent = _(contentL10nId);
    content.dataset.l10nId = contentL10nId;

    var select = document.createElement('select');
    select.dataset.perm = perm;

    var askOpt = document.createElement('option');
    askOpt.value = 'prompt';
    askOpt.text = _('ask');
    select.add(askOpt);

    var denyOpt = document.createElement('option');
    denyOpt.value = 'deny';
    denyOpt.text = _('deny');
    select.add(denyOpt);

    var allowOpt = document.createElement('option');
    allowOpt.value = 'allow';
    allowOpt.text = _('allow');
    select.add(allowOpt);

    select.value = value;
    select.setAttribute('value', value);
    select.onchange = this.selectValueChanged.bind(this);

    item.onclick = function focusSelect() {
      select.focus();
    };

    content.appendChild(select);
    item.appendChild(content);
    this.detailPermissionsList.appendChild(item);
  },

  selectValueChanged: function al_selectValueChanged(evt) {
    if (!this._displayedApp)
      return;

    var select = evt.target;
    select.setAttribute('value', select.value);
    this._changePermission(this._displayedApp,
                           select.dataset.perm, select.value);
  },

  uninstall: function al_uninstall() {
    if (!this._displayedApp)
      return;

    var _ = navigator.mozL10n.get;
    var name = new ManifestHelper(this._displayedApp.manifest).name;

    if (confirm(_('uninstallConfirm', {app: name}))) {
      navigator.mozApps.mgmt.uninstall(this._displayedApp);
      this._displayedApp = null;
    }
  },

  _changePermission: function al_removePermission(app, perm, value) {
    var mozPerms = navigator.mozPermissionSettings;
    if (!mozPerms)
      return;

    var table = this._permissionsTable;

    // We edit the composed permission for all the access modes
    if (table.composedPermissions.indexOf(perm) !== -1) {
      table.accessModes.forEach(function modeIterator(mode) {
        var composedPerm = perm + '-' + mode;
        try {
          mozPerms.set(composedPerm, value, app.manifestURL, app.origin, false);
        } catch (e) {
          console.warn('Failed to set the ' + composedPerm + 'permission.');
        }
      }, this);

      return;
    }

    try {
      mozPerms.set(perm, value, app.manifestURL, app.origin, false);
    } catch (e) {
      console.warn('Failed to set the ' + perm + 'permission.');
    }
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
