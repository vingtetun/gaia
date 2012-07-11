
'use strict';

const Homescreen = (function() {
  PaginationBar.init('.paginationScroller');
  GridManager.init('.apps');

  var host = document.location.host;
  var domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2');

  var shortcuts = document.querySelectorAll('#footer li');
  for (var i = 0; i < shortcuts.length; i++) {
    var dataset = shortcuts[i].dataset;
    dataset.origin = dataset.origin.replace('$DOMAIN$', domain);
  }

  var mode = 'normal';
  var footer = document.querySelector('#footer');
  GridManager.onEditModeChange = function onEditModeChange(value) {
    footer.dataset.mode = mode = value;
  }

  // XXX Currently the home button communicate only with the
  // system application. It should be an activity that will
  // use the system message API.
  window.addEventListener('message', function onMessage(e) {
    var json = JSON.parse(e.data);
    var mode = json.type;

    switch (mode) {
      case 'home':
        if (appFrameIsActive) {
          var frame = document.getElementById('app-frame');
          document.body.removeChild(frame);
          appFrameIsActive = false;
        } else if (GridManager.isEditMode()) {
          GridManager.setMode('normal');
          Permissions.hide();
        } else {
          GridManager.goTo(0);
        }
        break;
      case 'open-in-app':
        var url = json.data.url;
        openApp(url);
        break;
      case 'add-bookmark':
        // Add a new bookmark to the homescreen
        var title = json.data.title;
        var url = json.data.url;
        var icon = json.data.icon;
        break;
    }
  });

  var appFrameIsActive = false;

  function openApp(url) {
    // This is not really fullscreen, do we expect fullscreen?
    var frame = document.createElement('iframe');
    frame.id = 'app-frame';
    frame.setAttribute('mozbrowser', 'mozbrowser');
    frame.src = url;
    document.body.appendChild(frame);

    appFrameIsActive = true;
  }

  // Listening for installed apps
  Applications.addEventListener('install', function oninstall(app) {
    GridManager.install(app);
  });

  // Listening for uninstalled apps
  Applications.addEventListener('uninstall', function onuninstall(app) {
    GridManager.uninstall(app);
  });

  // Listening for clicks on the footer
  footer.addEventListener('click', function footer_onclick(event) {
    if (mode === 'normal') {
      var dataset = event.target.dataset;
      if (dataset && typeof dataset.origin !== 'undefined') {
        var app = Applications.getByOrigin(dataset.origin);
        if (dataset.entrypoint) {
          app.launch('#' + dataset.entrypoint);
        } else {
          app.launch();
        }
      }
    }
  });

  return {
    /*
     * Displays the contextual menu given an origin
     *
     * @param {String} the app origin
     */
    showAppDialog: function showAppDialog(origin) {
      // FIXME: localize this message
      var app = Applications.getByOrigin(origin);
      var title = 'Remove ' + app.manifest.name;
      var body = 'This application will be uninstalled fully from your mobile';
      Permissions.show(title, body,
                       function onAccept() { app.uninstall() },
                       function onCancel() {});
    }
  };
})();

