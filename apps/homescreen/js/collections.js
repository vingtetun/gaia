'use strict';

var Collection = function Collection(params, cb) {
  GridItem.call(this, params);

  this.iconable = false;
  this.type = GridItemsFactory.TYPE.COLLECTION;
  this.hideFromGrid = !!params.hideFromGrid;
  this.providerId = params.provider_id || params.id;
  this.collectionId = params.provider_id || params.id;
  this.categoryId = params.categoryId;
  this.pinned = params.pinned;
};

Collection.prototype = {
  __proto__: GridItem.prototype,

  launch: function sc_launch() {
    var features = this.getFeatures();
    // Enriching features...
    features.id = this.providerId;
    features.categoryId = this.categoryId;

    new MozActivity({
      name: 'view-collection',
      data: features
    });
  },

  migrateURL: function sc_migratePath(url) {
    if (url && url.startsWith(document.location.protocol)) {
      return url.replace('//homescreen.', '//collection.');
    } else {
      return url;
    }
  },

  getDescriptor: function sc_getDescriptor(cb) {
    var descriptor = GridItem.prototype.getDescriptor.call(this);
    descriptor.collectionId = this.providerId;
    descriptor.pinned = this.manifest.apps || [];
    descriptor.icon = this.migrateURL(descriptor.icon);

    asyncStorage.getItem('evme-collectionsettings_' + this.id, function(data) {
      if (data && data.value) {
        data = data.value;
        descriptor.name = data.name;
        descriptor.background = data.bg;
        descriptor.collectionId = data.experienceId || descriptor.collectionId;
        descriptor.query = data.query;
        descriptor.defaultIcon = this.migrateURL(data.defaultIcon);
        descriptor.webicons = data.extraIconsData;
        descriptor.pinned = data.apps;
      }

      cb(descriptor);
    }.bind(this));
  }
};

(function(exports) {
  var CollectionsListener = {
    handleEvent: function(e) {
      switch (e.type) {
        case 'added':
        case 'updated':
          GridManager.install(new Collection(e.target));
          break;
        case 'removed':
          var collectionIndex = Collection.prototype.generateIndex(e.target.id);
          var icon = GridManager.getIconForCollection(collectionIndex);
          icon && icon.app.uninstall();
          markDirtyState();
          break;
      }
      updateHomescreenRevisionId();
    }
  };

  var eventTypesToListenFor = ['added', 'updated', 'removed'];
  var revisionIdStorageKey = 'collectionRevisionStorageKey';

  function updateHomescreenRevisionId() {
    CollectionsDatabase.getRevisionId().then(
      function gotRevisionId(revisionId) {
        asyncStorage.setItem(revisionIdStorageKey, revisionId);
    });
  }

  exports.CollectionsManager = {
    attachListeners: function bm_attachListeners() {
      eventTypesToListenFor.forEach(function iterateTypes(type) {
        CollectionsDatabase.addEventListener(type, CollectionsListener);
      });
    },

    getHomescreenRevisionId: function bm_getHomescreenRevisionId(cb) {
      asyncStorage.getItem(revisionIdStorageKey, cb);
    },

    updateHomescreenRevisionId: updateHomescreenRevisionId
  };
}(window));
