
'use strict';

var Homescreen = (function() {
  var mode = 'normal';
  var origin = document.location.protocol + '//homescreen.' +
    document.location.host.replace(/(^[\w\d]+.)?([\w\d]+.[a-z]+)/, '$2');
  var iconGrid = document.getElementById('icongrid');

  var initialized = false;
  onConnectionChange(navigator.onLine);

  function initialize(lPage, onInit) {
    if (initialized) {
      return;
    }

    initialized = true;

    var options = {
      gridSelector: '.apps'
    };

    GridManager.init(options, function gm_init() {
      navigator.mozL10n.ready(GridManager.localize.bind(GridManager));

      window.addEventListener('hashchange', function() {
        if (!window.location.hash.replace('#', '')) {
          return;
        }

        if (Homescreen.isInEditMode()) {
          exitFromEditMode();
        } else if (!document.hidden) {
          var step;
          var scrollable = iconGrid;

          var doScroll = function() {
            var scrollY = scrollable.scrollTop;
            step = step || (scrollY / 20);

            if (!scrollY) {
              return;
            }

            if (scrollY <= step) {
              scrollable.scrollTop = 0;
              return;
            }

            scrollable.scrollTop -= step;
            window.requestAnimationFrame(doScroll);
          };

          doScroll();
        }
      });

      document.body.addEventListener('contextmenu', onContextMenu);
      IconManager.init(Configurator.getSection('tap_effect_delay'));

      if (typeof onInit === 'function') {
        onInit();
      }
    });
  }

  function onContextMenu(evt) {
    // See Bug 1011389 - [APZ] Click events are fired after a long press, even
    // if the user has moved the finger
    evt.preventDefault();
    evt.stopPropagation();

    var target = evt.target;

    if ('isIcon' in target.dataset) {
      GridManager.contextmenu(evt);
      if (Homescreen.isInEditMode()) {
        iconGrid.addEventListener('click', onClickHandler);
      }
    } else if (!Homescreen.isInEditMode()) {
      // No long press over an icon neither edit mode
      evt.preventDefault();
      var contextMenuEl = document.getElementById('contextmenu-dialog');

      var searchPage = Configurator.getSection('search_page');
      if (searchPage && searchPage.enabled) {
        LazyLoader.load(['style/contextmenu.css',
                         'shared/style/action_menu.css',
                         contextMenuEl,
                         'js/contextmenu.js'
                         ], function callContextMenu() {
                          navigator.mozL10n.translate(contextMenuEl);
                          ContextMenuDialog.show();
                        }
        );
      } else {
        // only wallpaper
        LazyLoader.load(['shared/js/omadrm/fl.js', 'js/wallpaper.js'],
                      function callWallpaper() {
                        Wallpaper.contextmenu();
                      });
      }
    }
  }
  // dismiss edit mode by tapping in an area of the view where there is no icon
  function onClickHandler(evt) {
    if (!('isIcon' in evt.target.dataset)) {
      exitFromEditMode();
    }
  }

  function exitFromEditMode() {
    iconGrid.removeEventListener('click', onClickHandler);
    Homescreen.setMode('normal');
    GridManager.exitFromEditMode();
    if (typeof ConfirmDialog !== 'undefined') {
      ConfirmDialog.hide();
    }
  }

  document.addEventListener('visibilitychange', function mozVisChange() {
    if (document.hidden && Homescreen.isInEditMode()) {
      exitFromEditMode();
    }

    if (document.hidden == false) {
      setTimeout(function forceRepaint() {
        var helper = document.getElementById('repaint-helper');
        helper.classList.toggle('displayed');
      });
    }
  });

  function onConnectionChange(isOnline) {
    var mode = isOnline ? 'online' : 'offline';
    document.body.dataset.online = mode;
  }

  window.addEventListener('online', function onOnline(evt) {
    onConnectionChange(true);
  });

  window.addEventListener('offline', function onOnline(evt) {
    onConnectionChange(false);
  });

  return {
    /*
     * Displays the contextual menu given an app.
     *
     * @param {Object} Icon object
     *
     */
    showAppDialog: function h_showAppDialog(icon) {
      if (icon.app.type === GridItemsFactory.TYPE.BOOKMARK) {
        new MozActivity({
          name: 'remove-bookmark',
          data: {
            type: 'url',
            url: icon.app.id
          }
        });
        return;
      }

      LazyLoader.load(['shared/style/confirm.css',
                       'style/request.css',
                       document.getElementById('confirm-dialog'),
                       'js/request.js'], function loaded() {
        ConfirmDialog.showApp(icon);
      });
    },

    showEditBookmarkDialog: function h_showEditBookmarkDialog(icon) {
      new MozActivity({
        name: 'save-bookmark',
        data: {
          type: 'url',
          url: icon.app.id
        }
      });
    },

    isInEditMode: function() {
      return mode === 'edit';
    },

    init: initialize,

    setMode: function(newMode) {
      mode = document.body.dataset.mode = newMode;
    }
  };
})();
