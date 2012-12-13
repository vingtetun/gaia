

function debug(str) {
  dump(" -*- webapp-l10n.js: " + str + "\n");
}

let DOMParser = Components.Constructor(
                  "@mozilla.org/xmlextras/domparser;1",
                  "nsIDOMParser");

debug("webapp-l10n.js: Begin");

Gaia.webapps.forEach(function(webapp) {
  // If BUILD_APP_NAME isn't `*`, we only accept one webapp
  if (BUILD_APP_NAME != '*' &&
      webapp.sourceDirectoryName != BUILD_APP_NAME)
    return;

  debug(webapp.sourceDirectoryName);
  let files = ls(webapp.sourceDirectoryFile);
  files.forEach(function(file) {
    // Ignore files from /shared directory (these files were created by
    // Makefile code). Also ignore files in the /test directory.
    if (file.leafName == "shared" || file.leafName == "test")
      return;

    compile(file);
  });
});


function compile(file) {
  if (file.leafName === "index.html") {
    document = (new DOMParser()).parseFromString(getFileContent(file),
                                                     "text/html");

    navigator.mozL10n.translate(document.documentElement);
  }
}

var dispatchEvent = function() {
  debug(document.body.innerHTML);
}

var XMLHttpRequest = function() {
  var path = '';
  var propertiesCallback = null;

  function open(type, url, async) {
    path = url;
    this.readyState = 4;
    this.status = 0;

    debug(path);
    let file = new FileUtils.File(GAIA_DIR);

    var paths = path.split('/');
    var firstDir = paths.shift();
    if (firstDir != "shared") {
      file.append('apps');
      file.append('settings');
      file.append(firstDir);
    } else {
      file.append(firstDir);
    }

    paths.forEach(function appendPath(name) {
      file.append(name);
      if (name == "branding") {
        if (OFFICIAL) {
          file.append("official");
        } else {
          file.append("unofficial");
        }
      }
    });
    debug(file.path);

    this.responseText = getFileContent(file);
  }

  function send() {
    this.onreadystatechange();
  }

  return {
    open: open,
    send: send,
    onreadystatechange: null
  }
}

l10nCallback();

debug("webapp-l10n.js: End");
