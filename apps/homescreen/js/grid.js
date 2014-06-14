'use strict';

var GridManager = (function() {
  var HIDDEN_ROLES = ['system', 'input', 'homescreen', 'search'];
  function isHiddenApp(role) {
    if (!role) {
      return false;
    }

    return (HIDDEN_ROLES.indexOf(role) !== -1);
  }

  // Holds the list of single variant apps that have been installed
  // previously already
  var svPreviouslyInstalledApps = [];

  // XXX bug 911696 filter out launch_path
  var launchPathBlacklist = [];

  var pages = [];

  var MAX_NUMBER_OF_ICONS = 50;

  var _ = navigator.mozL10n.get;

  var startEvent = null;
  function touchstart(evt) {
    startEvent = evt.touches[0];
    IconManager.addActive(evt.target);
  }

  function touchmove(evt) {
    var touch = evt.touches[0] || evt.changedTouches[0];
    if (Math.abs(touch.pageX - startEvent.pageX) > 5 ||
        Math.abs(touch.pageY - startEvent.pageY) > 5) {
      IconManager.removeActive();
    }
  }

  function tap(evt) {
    var touch = evt.changedTouches[0];
    if (Math.abs(touch.pageX - startEvent.pageX) <= 5 &&
        Math.abs(touch.pageY - startEvent.pageY) <= 5) {
      IconManager.cancelActive();
      var page = pageHelper.getPageFor(evt.target) ||
                 pageHelper.getPageFor(evt.target.parentNode);
      if (page) {
        page.tap(evt.target, IconManager.removeActive);
      }
    }
  }

  function contextmenu(evt) {
    Homescreen.setMode('edit', function ready() {
      IconManager.removeActive();
      LazyLoader.load(['style/dragdrop.css', 'js/dragdrop.js'], function() {
        DragDropManager.init();
        DragDropManager.start(evt, {
          'x': startEvent.pageX,
          'y': startEvent.pageY
        });
      });
    });
  }

  function handleEvent(evt) {
    switch (evt.type) {
      case 'touchstart':
        touchstart(evt);
        break;

      case 'touchmove':
      case 'touchcancel':
        touchmove(evt);
        break;

      case 'touchend':
        tap(evt);
        break;
    }
  }

  function exitFromEditMode() {
    markDirtyState();
  }

  var saveStateTimeout = null;
  function markDirtyState() {
    window.clearTimeout(saveStateTimeout);
    saveStateTimeout = window.setTimeout(function saveStateTrigger() {
      saveStateTimeout = null;
      pageHelper.saveAll();
      HomeState.saveSVInstalledApps(GridManager.svPreviouslyInstalledApps);
    }, 100);
  }

  /*
   * UI Localization
   *
   */
  var haveLocale = false;

  function localize() {
    for (var manifestURL in appIcons) {
      var iconsForApp = appIcons[manifestURL];
      for (var entryPoint in iconsForApp) {
        iconsForApp[entryPoint].translate();
      }
    }

    for (var bookmarkURL in bookmarkIcons) {
      bookmarkIcons[bookmarkURL].translate();
    }

    for (var collectionId in collectionsIcons) {
      collectionsIcons[collectionId].translate();
    }

    haveLocale = true;
  }

  function removeEmptyPages() {
    for (var i = pages.length - 1; i >= 0; i--) {
      if (pages[i].getNumIcons() === 0) {
        pageHelper.remove(i);
      }
    }
  }

  var container;

  var pageHelper = {
    /*
     * Adds a new page to the grid layout
     *
     * @param {Array} icons
     *                List of Icon objects.
     */
    addPage: function(icons, numberOficons) {
      var pageElement = document.createElement('div');
      var page = new Page(pageElement, icons, MAX_NUMBER_OF_ICONS);
      pages.push(page);

      pageElement.className = 'page';
      pageElement.setAttribute('role', 'region');
      container.appendChild(pageElement);
    },

    /*
     * Removes an specific page
     *
     * @param {int} index of the page
     */
    remove: function gm_remove(index) {
      pages[index].destroy(); // Destroy page
      pages.splice(index, 1); // Removes page from the list
    },

    /*
     * Saves all pages state on the database
     */
    saveAll: function() {
      var state = pages.slice(0);
      for (var i = 0; i < state.length; i++) {
        var page = state[i];
        var icons = page.getIconDescriptors();
        if (icons.length === 0 && i == state.length - 1) {
          state.pop();
          continue;
        }

        state[i] = {
          index: i,
          icons: icons
        };
      }
      HomeState.saveGrid(state);
    },

    getPage: function(index) {
      return pages[index];
    },

    getPageFor: function(target) {
      var pages = container.querySelectorAll('ol');
      for (var i = 0; i < pages.length; i++) {
        if (pages[i] === target.parentNode) {
          return this.getPage(i);
        }
      }

      return null;
    },

    getPageIndexFor: function(target) {
      var pages = container.querySelectorAll('ol');
      for (var i = 0; i < pages.length; i++) {
        if (pages[i] === target) {
          return i;
        }
      }

      return -1;
    },

    getPageForPosition: function(x, y) {
      var pages = container.querySelectorAll('.page');
      for (var i = 0; i < pages.length; i++) {
        var rect = pages[i].getBoundingClientRect();
        if (x >= rect.left && x <= rect.left + rect.width &&
            y >= rect.top && y <= rect.top + rect.height) {
          return this.getPage(i);
        }
      }

      return null;
    },

    /*
     * Returns the total number of pages
     */
    getTotalPagesNumber: function() {
      return pages.length;
    }
  };


  /*
   * Look up Icon objects using a descriptor containing 'manifestURL'
   * (optionally 'entry_point') or 'bookmarkURL'.
   */

  // Map 'bookmarkURL' -> Icon object.
  var bookmarkIcons;
  // Map 'manifestURL' + 'entry_point' to Icon object.
  var appIcons;
  // Map 'origin' -> app object.
  var appsByOrigin;
  // Map 'id' for bookmarks -> bookmark object.
  var bookmarksById;
  // Map 'id' for collections -> bookmark object.
  var collectionsById;
  var collectionsIcons;


  function rememberIcon(icon) {
    var descriptor = icon.descriptor;
    if (descriptor.bookmarkURL) {
      bookmarkIcons[descriptor.bookmarkURL] = icon;
      return;
    }

    if (descriptor.collectionId) {
      collectionsIcons[descriptor.collectionId] = icon;
      return;
    }
    var iconsForApp = appIcons[descriptor.manifestURL];
    if (!iconsForApp)
      iconsForApp = appIcons[descriptor.manifestURL] = Object.create(null);

    iconsForApp[descriptor.entry_point || ''] = icon;
  }

  function forgetIcon(icon) {
    var descriptor = icon.descriptor;
    if (descriptor.bookmarkURL) {
      delete bookmarkIcons[descriptor.bookmarkURL];
      return;
    }
    if (descriptor.collectionId) {
      delete collectionsIcons[descriptor.collectiondId];
      return;
    }
    var iconsForApp = appIcons[descriptor.manifestURL];
    if (!iconsForApp)
      return;

    delete iconsForApp[descriptor.entry_point || ''];
  }

  function getIcon(descriptor) {
    if (descriptor.bookmarkURL) {
      return bookmarkIcons[descriptor.bookmarkURL];
    }

    if (descriptor.collectionId) {
      return collectionsIcons[descriptor.collectionId];
    }

    var iconsForApp = appIcons[descriptor.manifestURL];
    return iconsForApp && iconsForApp[descriptor.entry_point || ''];
  }

  function getIconByOrigin(origin, entryPoint) {
    var app = appsByOrigin[origin];
    return app ? getIcon(buildDescriptor(app, entryPoint)) : undefined;
  }

  function getIconsForApp(app) {
    return appIcons[app.manifestURL];
  }

  function getIconForBookmark(bookmarkURL) {
    return bookmarkIcons[bookmarkURL];
  }

  function getIconForCollection(collectionId) {
    return collectionsIcons[collectionId];
  }

  /**
   * Ways to enumerate installed apps & bookmarks and find
   * out whether a certain "origin" is available as an existing installed app or
   * bookmark. Only used by Everything.me at this point.
   * @param {Boolean} expands manifests with multiple entry points.
   * @param {Boolean} disallows hidden apps.
   * @return {Array} icon objects.
   */
  function getApps(expandApps, suppressHiddenRoles) {
    var apps = [];
    for (var origin in appsByOrigin) {
      var app = appsByOrigin[origin];

      // app.manifest is null until the downloadsuccess/downloadapplied event
      var manifest = app.manifest || app.updateManifest;

      if (!manifest || app.type === GridItemsFactory.TYPE.COLLECTION ||
          (suppressHiddenRoles && isHiddenApp(manifest.role))) {
        continue;
      }

      if (expandApps && manifest.entry_points) {
        var entryPoints = manifest.entry_points;
        for (var entryPoint in entryPoints) {
          if (!entryPoints[entryPoint].icons) {
            continue;
          }
          apps.push(new Icon(buildDescriptor(app, entryPoint), app));
        }
        continue;
      }

      apps.push(new Icon(buildDescriptor(app), app));
    }
    return apps;
  }

  function getApp(origin) {
    var app = appsByOrigin[origin] || bookmarkIcons[origin].app;
    if (app) {
      return new Icon(buildDescriptor(app), app);
    }
    return null;
  }

  /*
   * Initialize the UI.
   */
  function initUI(selector) {
    window.addEventListener('touchstart', handleEvent);
    window.addEventListener('touchmove', handleEvent);
    window.addEventListener('touchcancel', handleEvent);
    window.addEventListener('touchend', handleEvent);

    container = document.querySelector(selector);

    // Create stub Page objects for the special pages that are
    // not backed by the app database. Note that this creates an
    // offset between these indexes here and the ones in the DB.
    // See also pageHelper.saveAll().
    for (var i = 0; i < container.children.length; i++) {
      var pageElement = container.children[i];
      if (!pageElement.classList.contains('page')) {
        continue;
      }

      var page = new Page(pageElement, null);
      pages.push(page);
    }
  }

  // Store the pending apps to be installed until SingleVariant conf is loaded
  var pendingInstallRequests = [];

  function addSVEventListener() {
    window.addEventListener('singlevariant-ready', function svFileReady(ev) {
      window.removeEventListener('singlevariant-ready', svFileReady);
      pendingInstallRequests.forEach(GridManager.install);
    });
  }

  function processBookmarks(done) {
    BookmarksManager.getHomescreenRevisionId(function(homescreenRevisionId) {
      if (!homescreenRevisionId) {
        // We have to populate the datastore with bookmarks already installed.
        // Just the first time after updating the device from 1.4 to 2.0 version
        var bookmarks = Object.keys(bookmarksById);
        var numberBookmarks = bookmarks.length;
        if (numberBookmarks === 0) {
          // No bookmarks to migrate to the datastore. Basically it means that
          // user had no bookmarks in 1.4 or it is a new device 2.0
          mergeBookmarks(done);
          return;
        }

        var onProccessed = function() {
          if (--numberBookmarks === 0) {
            mergeBookmarks(done);
          }
        };

        // At this point we are going to propagate our bookmarks to system
        bookmarks.forEach(function(id) {
          BookmarksDatabase.add(bookmarksById[id].getDescriptor()).
                            then(onProccessed, onProccessed);
        });
      } else {
        BookmarksDatabase.getRevisionId().then(function(systemRevisionId) {
          if (homescreenRevisionId !== systemRevisionId) {
            // Not synchronized (bookmarks added/modified/deleted while it was
            // not running)
            mergeBookmarks(done);
          } else {
            // Same revision in system and home, nothing to do here...
            done();
          }
        }, done);
      }
    });
  }

  function mergeBookmarks(done) {
    BookmarksDatabase.getAll().then(function(systemBookmarks) {
      // We are going to iterate over system bookmarks
      Object.keys(systemBookmarks).forEach(function(id) {
        if (bookmarksById[id]) {
          // Deleting from the list because it should not be removed from grid
          delete bookmarksById[id];
        }
        // Adding or updating bookmark
        processApp(new Bookmark(systemBookmarks[id]));
      });

      // Deleting bookmarks that are not stored in the datastore. The
      // homescreen won't show bookmarks that are not in the system
      Object.keys(bookmarksById).forEach(function(id) {
        var icon = getIconForBookmark(bookmarksById[id].bookmarkURL);
        if (icon) {
          icon.remove();
          markDirtyState();
        }
      });

      done();
    }, done);
  }

  function processCollections(done) {
    CollectionsManager.getHomescreenRevisionId(function(homescreenRevisionId) {
      if (!homescreenRevisionId) {
        // We have to populate the datastore with collections already installed.
        // Just the first time after updating the device from 1.4 to 2.0 version
        var collections = Object.keys(collectionsById);
        var numberCollections = collections.length;
        if (numberCollections === 0) {
          return;
        }

        var onProccessed = function() {
          if (--numberCollections === 0) {
            mergeCollections(done);
          }
        };

        // At this point we are going to propagate our collections to system
        collections.forEach(function(id) {
          collectionsById[id].getDescriptor(function(descriptor) {
            CollectionsDatabase.add(descriptor)
                               .then(onProccessed, onProccessed);
          });
        });
      } else {
        CollectionsDatabase.getRevisionId().then(function(systemRevisionId) {
          if (homescreenRevisionId !== systemRevisionId) {
            // Not synchronized (bookmarks added/modified/deleted while it was
            // not running)
            mergeCollections(done);
          } else {
            // Same revision in system and home, nothing to do here...
            done();
          }
        }, done);
      }
    });
  }

  function mergeCollections(done) {
    CollectionsDatabase.getAll().then(function(systemCollections) {
      // We are going to iterate over system bookmarks
      Object.keys(systemCollections).forEach(function(id) {
        if (collectionsById[id]) {
          // Deleting from the list because it should not be removed from grid
          delete collectionsById[id];
        }
        // Adding or updating collection
        GridManager.install(new Collection(systemCollections[id]));
      });

      // Deleting collections that are not stored in the datastore. The
      // homescreen won't show collections that are not in the system
      Object.keys(collectionsById).forEach(function(id) {
        var icon = getIconForCollection(collectionsById[id].collectionId);
        icon && icon.app.uninstall();
      });

      done();
    }, done);
  }

  /*
   * Initialize the mozApps event handlers and synchronize our grid
   * state with the applications known to the system.
   */
  function initApps(callback) {
    var appMgr = navigator.mozApps.mgmt;

    if (!appMgr) {
      setTimeout(callback);
      return;
    }

    processBookmarks(function done() {
      BookmarksManager.updateHomescreenRevisionId();
      BookmarksManager.attachListeners();
      bookmarksById = null;
    });

    processCollections(function done() {
      CollectionsManager.updateHomescreenRevisionId();
      CollectionsManager.attachListeners();
      collectionsById = null;
    });

    appMgr.oninstall = function oninstall(event) {
      if (Configurator.isSingleVariantReady) {
        GridManager.install(event.application);
      } else {
        pendingInstallRequests.push(event.application);
      }
    };

    appMgr.onuninstall = function onuninstall(event) {
      GridManager.uninstall(event.application);
    };

    appMgr.getAll().onsuccess = function onsuccess(event) {
      // Create a copy of all icons we know about so we can find out which icons
      // should be removed.
      var iconsByManifestURL = Object.create(null);
      for (var manifestURL in appIcons) {
        iconsByManifestURL[manifestURL] = appIcons[manifestURL];
      }

      // Add an empty page where we drop the icons for any extra apps we
      // discover at this stage.
      pageHelper.addPage([]);

      var apps = event.target.result;
      apps.forEach(function eachApp(app) {
        delete iconsByManifestURL[app.manifestURL];
        processApp(app, null, 0 /* Start at the beginning */);
      });

      for (var manifestURL in iconsByManifestURL) {
        var iconsForApp = iconsByManifestURL[manifestURL];
        for (var entryPoint in iconsForApp) {
          var icon = iconsForApp[entryPoint];
          if (icon) {
            icon.remove();
            markDirtyState();
          }
        }
      }

      callback();
    };
  }

  /*
   * Create Icon objects from the descriptors we save in IndexedDB.
   */
  function convertDescriptorsToIcons(pageState) {
    var icons = pageState.icons;
    for (var i = 0; i < icons.length; i++) {
      var descriptor = icons[i];
      // navigator.mozApps backed app will objects will be handled
      // asynchronously and therefore at a later time.
      var app = null;
      if (descriptor.bookmarkURL && !descriptor.type) {
        // pre-1.3 bookmarks
        descriptor.type = GridItemsFactory.TYPE.BOOKMARK;
      }

      if (descriptor.type === GridItemsFactory.TYPE.BOOKMARK ||
          descriptor.type === GridItemsFactory.TYPE.COLLECTION ||
          descriptor.role === GridItemsFactory.TYPE.COLLECTION) {
        if (descriptor.manifestURL) {
          // At build time this property is manifestURL instead of bookmarkURL
          descriptor.id = descriptor.bookmarkURL = descriptor.manifestURL;
          descriptor.type = GridItemsFactory.TYPE.COLLECTION;
        }
        app = GridItemsFactory.create(descriptor);
        if (app.type === GridItemsFactory.TYPE.COLLECTION) {
          appsByOrigin[app.origin] = app;
          if (haveLocale) {
            descriptor.localizedName = _(app.manifest.name);
          }
          collectionsById[app.collectionId] = app;
        } else {
          bookmarksById[app.id] = app;
        }
      }

      var icon = icons[i] = new Icon(descriptor, app);
      rememberIcon(icon);
    }
    return icons;
  }

  /*
   * Process an Application object as retrieved from the
   * navigator.mozApps.mgmt API (or a Bookmark object) and create
   * corresponding icon(s) for it (an app can have multiple entry
   * points, each one is represented as an icon.)
   */
  function processApp(app, callback, gridPageOffset, gridPosition) {
    appsByOrigin[app.origin] = app;

    var manifest = app.manifest ? app.manifest : app.updateManifest;
    if (!manifest)
      return;

    var entryPoints = manifest.entry_points;
    if (!entryPoints || manifest.type !== 'certified') {
      createOrUpdateIconForApp(app, null, gridPageOffset, gridPosition);
      return;
    }

    for (var entryPoint in entryPoints) {
      if (!entryPoints[entryPoint].icons)
        continue;

      // do the normal procedure
      if (launchPathBlacklist.length === 0) {
        createOrUpdateIconForApp(app, entryPoint, gridPageOffset, gridPosition);
        continue;
      }

      var found = false;
      // filtering with blacklist
      for (var i = 0, elemNum = launchPathBlacklist.length;
         i < elemNum; i++) {
        if (entryPoints[entryPoint].launch_path === launchPathBlacklist[i]) {
          found = true;
          break;
        }
      }

      if (!found) {
        createOrUpdateIconForApp(app, entryPoint, gridPageOffset, gridPosition);
      }
    }
  }

  /*
    Detect if an app can work offline
  */
  function isHosted(app) {
    if (app.origin) {
      return app.origin.indexOf('app://') === -1;
    }

    return false;
  }

  function hasOfflineCache(app) {
    if (app.type === GridItemsFactory.TYPE.COLLECTION) {
      return true;
    } else {
      var manifest = app ? app.manifest || app.updateManifest : null;
      return manifest.appcache_path != null;
    }
  }

  /*
   * Add the manifest to the array of installed singlevariant apps
   * @param {string} app's manifest to add
   */
  function addPreviouslyInstalled(manifest) {
    if (!isPreviouslyInstalled(manifest)) {
      svPreviouslyInstalledApps.push({'manifest': manifest});
    }
  }

  /*
   * Return true if manifest is in the array of installed singleVariant apps,
   * false otherwise
   * @param {string} app's manifest consulted
   */
  function isPreviouslyInstalled(manifest) {
    for (var i = 0, elemNum = svPreviouslyInstalledApps.length;
         i < elemNum; i++) {
      if (svPreviouslyInstalledApps[i].manifest === manifest) {
        return true;
      }
    }
    return false;
  }

  /*
   * SV - Return the single operator app (identify by manifest) or undefined
   * if the manifesURL doesn't correspond with a SV app
   */
  function getSingleVariantApp(manifestURL) {
    var singleVariantApps = Configurator.getSingleVariantApps();
    if (manifestURL in singleVariantApps) {
      var app = singleVariantApps[manifestURL];
      if (app.screen !== undefined && app.location !== undefined) {
        return app;
      }
    }
  }


  /*
   * Builds a descriptor for an icon object
   */
  function buildDescriptor(app, entryPoint) {
    var manifest = app.manifest ? app.manifest : app.updateManifest;

    if (!manifest)
      return;

    var iconsAndNameHolder = manifest;
    if (entryPoint)
      iconsAndNameHolder = manifest.entry_points[entryPoint];

    iconsAndNameHolder = new ManifestHelper(iconsAndNameHolder);

    var descriptor = {
      bookmarkURL: app.bookmarkURL,
      url: app.url,
      manifestURL: app.manifestURL,
      entry_point: entryPoint,
      updateTime: app.updateTime,
      removable: app.removable,
      name: iconsAndNameHolder.name,
      icon: bestMatchingIcon(app, iconsAndNameHolder),
      useAsyncPanZoom: app.useAsyncPanZoom,
      isHosted: isHosted(app),
      hasOfflineCache: hasOfflineCache(app),
      type: app.type,
      id: app.id,
      collectionId: app.collectionId
    };

    if (haveLocale) {
      if (app.type === GridItemsFactory.TYPE.COLLECTION) {
        descriptor.localizedName = _(manifest.name);
      } else if (app.type !== GridItemsFactory.TYPE.BOOKMARK) {
        descriptor.localizedName = iconsAndNameHolder.name;
      }
    }

    return descriptor;
  }

  function createOrUpdateIconForApp(app, entryPoint, gridPageOffset,
                                    gridPosition) {
    // Make sure we update the icon/label when the app is updated.
    if (app.type !== GridItemsFactory.TYPE.COLLECTION &&
        app.type !== GridItemsFactory.TYPE.BOOKMARK) {
      app.ondownloadapplied = function ondownloadapplied(event) {
        createOrUpdateIconForApp(event.application, entryPoint);
        app.ondownloadapplied = null;
        app.ondownloaderror = null;
      };
      app.ondownloaderror = function ondownloaderror(event) {
        createOrUpdateIconForApp(app, entryPoint);
      };
    }

    var descriptor = buildDescriptor(app, entryPoint);

    // If there's an existing icon for this bookmark/app/entry point already,
    // let it update itself.
    var existingIcon = getIcon(descriptor);
    if (existingIcon) {
      if (app.manifest && isHiddenApp(app.manifest.role)) {
        existingIcon.remove();
      } else {
        existingIcon.update(descriptor, app);
      }
      markDirtyState();
      return;
    }

    // If we have manifest and no updateManifest, do not add the icon:
    // this is especially the case for pre-installed hidden apps, like
    // keyboard, system, etc.
    if (app.manifest && !app.updateManifest &&
        isHiddenApp(app.manifest.role)) {
      return;
    }

    var icon = new Icon(descriptor, app);
    rememberIcon(icon);

    var index;
    if (gridPosition) {
      index = gridPosition.page || 0;
      pages[index].appendIconAt(icon, gridPosition.index || 0);
    } else {
      var svApp = getSingleVariantApp(app.manifestURL);
      if (svApp && !isPreviouslyInstalled(app.manifestURL)) {
        index = svApp.screen;
        icon.descriptor.desiredPos = svApp.location;
        if (!Configurator.isSimPresentOnFirstBoot && index < pages.length &&
            !pages[index].hasEmptySlot()) {
          index = Math.max(pages.length - 2, 0);
        } else {
          icon.descriptor.desiredScreen = index;
        }
      } else {
        index = Math.max(pages.length - 2, 0);
      }

      var iconList = [icon];
      while (iconList.length > 0) {
        icon = iconList.shift();
        index = icon.descriptor.desiredScreen || index;
        if (index < pages.length) {
          iconList = iconList.concat(pages[index].getMisplacedIcons(index));
          pages[index].appendIcon(icon);
        } else {
          pageHelper.addPage([icon]);
        }
      }
    }

    markDirtyState();
  }

  /*
   * Shows a dialog to confirm the download retry
   * calls the method 'download'. That's applied
   * to an icon, that has associated an app already.
   */
  function doShowRestartDownloadDialog(icon) {
    var app = icon.app;
    var confirm = {
      title: _('download'),
      callback: function onAccept() {
        app.download();
        app.ondownloaderror = function(evt) {
          icon.showCancelled();
          icon.updateAppStatus(evt.application);
        };
        app.onprogress = function onProgress(evt) {
          app.onprogress = null;
          icon.updateAppStatus(evt.application);
        };
        icon.showDownloading();
        ConfirmDialog.hide();
      },
      applyClass: 'recommend'
    };

    var cancel = {
      title: _('cancel'),
      callback: ConfirmDialog.hide
    };

    var localizedName = icon.descriptor.localizedName || icon.descriptor.name;
    ConfirmDialog.show(_('restart-download-title'),
      _('restart-download-body', {'name': localizedName}),
      cancel,
      confirm);
    return;
  }

  function showRestartDownloadDialog(icon) {
    LazyLoader.load(['shared/style/confirm.css',
                     'style/request.css',
                     document.getElementById('confirm-dialog'),
                     'js/request.js'], function loaded() {
      doShowRestartDownloadDialog(icon);
    });
  }

  function bestMatchingIcon(app, manifest) {
    // use 100px icons for tablet
    var notTinyLayout = !ScreenLayout.getCurrentLayout('tiny');
    var PREFERRED_ICON_SIZE =
      (notTinyLayout ? 90 : 60) * (window.devicePixelRatio || 1);

    if (app.installState === 'pending') {
      return app.downloading ?
        Icon.prototype.DOWNLOAD_ICON_URL :
        Icon.prototype.CANCELED_ICON_URL;
    }
    var icons = manifest.icons;
    if (!icons) {
      return getDefaultIcon(app);
    }

    var preferredSize = Number.MAX_VALUE;
    var max = 0;

    for (var size in icons) {
      size = parseInt(size, 10);
      if (size > max)
        max = size;

      if (size >= PREFERRED_ICON_SIZE && size < preferredSize)
        preferredSize = size;
    }
    // If there is an icon matching the preferred size, we return the result,
    // if there isn't, we will return the maximum available size.
    if (preferredSize === Number.MAX_VALUE)
      preferredSize = max;

    var url = icons[preferredSize];
    if (!url) {
      return getDefaultIcon(app);
    }

    // If the icon path is not an absolute URL, prepend the app's origin.
    if (url.indexOf('data:') == 0 ||
        url.indexOf('app://') == 0 ||
        url.indexOf('http://') == 0 ||
        url.indexOf('https://') == 0)
      return url;

    if (url.charAt(0) != '/') {
      console.warn('`' + manifest.name + '` app icon is invalid. ' +
                   'Manifest `icons` attribute should contain URLs -or- ' +
                   'absolute paths from the origin field.');
      return getDefaultIcon(app);
    }

    if (app.origin.slice(-1) == '/')
      return app.origin.slice(0, -1) + url;

    return app.origin + url;
  }

  var defaultAppIcon;
  var defaultBookmarkIcon;
  function calculateDefaultIcons() {
    defaultAppIcon = new TemplateIcon();
    defaultAppIcon.loadDefaultIcon();
    defaultBookmarkIcon = new TemplateIcon(true);
    defaultBookmarkIcon.loadDefaultIcon();
  }

  function doInit(options, callback) {
    calculateDefaultIcons();
    pages = [];
    bookmarkIcons = Object.create(null);
    appIcons = Object.create(null);
    appsByOrigin = Object.create(null);
    bookmarksById = Object.create(null);
    collectionsById = Object.create(null);
    collectionsIcons = Object.create(null);

    initUI(options.gridSelector);

    IconRetriever.init();

    // Initialize the grid from the state saved in IndexedDB.
    var showBodyTimeout;
    var showBodyFunction = function() {
      document.body.hidden = false;
    };

    HomeState.init(function eachPage(pageState) {
      var pageIcons = convertDescriptorsToIcons(pageState);
      pageHelper.addPage(pageIcons, MAX_NUMBER_OF_ICONS);
      clearTimeout(showBodyTimeout);
      showBodyTimeout = window.setTimeout(showBodyFunction, 50);
    }, function onSuccess() {
      initApps(callback);
    }, function onError(error) {
      initApps(callback);
    }, function eachSVApp(svApp) {
      GridManager.svPreviouslyInstalledApps.push(svApp);
    });
  }

  return {

    hiddenRoles: HIDDEN_ROLES,

    svPreviouslyInstalledApps: svPreviouslyInstalledApps,
    isPreviouslyInstalled: isPreviouslyInstalled,
    addPreviouslyInstalled: addPreviouslyInstalled,

    /*
     * Initializes the grid manager
     *
     * @param {Object} Hash of options passed from GridManager.init
     *
     * @param {Function} Success callback
     *
     */
    init: function gm_init(options, callback) {
      // Add listener which will alert us when the SingleVariant configuration
      // file has been read
      addSVEventListener();

      options['gridSelector'] = '.apps';

      // XXX bug 911696 get entrypoints blacklist from settings
      // then doInit
      if ('mozSettings' in navigator) {
        var key = 'app.launch_path.blacklist';
        var req = navigator.mozSettings.createLock().get(key);
        req.onsuccess = function onsuccess() {
          launchPathBlacklist = req.result[key] || [];
          doInit(options, callback);
        };
      } else {
        doInit(options, callback);
      }
    },

    onDragStart: function gm_onDragSart() {
      document.body.dataset.dragging = true;
    },

    onDragStop: function gm_onDragStop() {
      delete document.body.dataset.dragging;
      removeEmptyPages();

      // If the last page has been consumed, let's create a new
      // one in advance.
      pageHelper.addPage([]);
    },

    /*
     * Adds a new application to the layout when the user installed it
     * from market
     *
     * @param {Application} app
     *                      The application (or bookmark) object
     * @param {Object}      gridPageOffset
     *                      Position to install the app: number (page index)
     * @param {Object}      extra
     *                      Optional parameters
     */
    install: function gm_install(app, gridPageOffset, extra) {
      extra = extra || {};

      processApp(app, null, gridPageOffset);

      if (extra.callback) {
        extra.callback();
      }
    },

    /*
     * Removes an application from the layout
     *
     * @param {Application} app
     *                      The application object that's to be uninstalled.
     */
    uninstall: function gm_uninstall(app) {
      delete appsByOrigin[app.origin];

      if (app.type === GridItemsFactory.TYPE.COLLECTION) {
        var icon = collectionsIcons[app.collectionId];
        icon.remove();
        delete collectionsIcons[app.collectionId];
      } else if (app.type === GridItemsFactory.TYPE.BOOKMARK) {
        var icon = bookmarkIcons[app.bookmarkURL];
        icon.remove();
        delete bookmarkIcons[app.bookmarkURL];
      } else {
        var iconsForApp = appIcons[app.manifestURL];
        if (!iconsForApp)
          return;

        for (var entryPoint in iconsForApp) {
          var icon = iconsForApp[entryPoint];
          icon.app.ondownloadapplied = icon.app.ondownloaderror = null;
          icon.remove();
        }
        delete appIcons[app.manifestURL];
      }

      if (app.type === GridItemsFactory.TYPE.COLLECTION) {
        window.dispatchEvent(new CustomEvent('collectionUninstalled', {
          'detail': {
            'collection': app
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('appUninstalled', {
          'detail': {
            'descriptor': buildDescriptor(app)
          }
        }));
      }

      removeEmptyPages();
      markDirtyState();
    },

    markDirtyState: markDirtyState,

    getIcon: getIcon,

    getIconByOrigin: getIconByOrigin,

    getIconsForApp: getIconsForApp,

    getIconForBookmark: getIconForBookmark,

    getIconForCollection: getIconForCollection,

    getApp: getApp,

    getApps: getApps,

    localize: localize,

    pageHelper: pageHelper,

    getBlobByDefault: function(app) {
      if (app && app.iconable) {
        return defaultBookmarkIcon.descriptor.renderedIcon;
      } else {
        return defaultAppIcon.descriptor.renderedIcon;
      }
    },

    showRestartDownloadDialog: showRestartDownloadDialog,

    exitFromEditMode: exitFromEditMode,

    contextmenu: contextmenu,

    forgetIcon: forgetIcon,

    rememberIcon: rememberIcon
  };
})();
