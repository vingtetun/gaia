

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
    let document = (new DOMParser()).parseFromString(getFileContent(file),
                                                     "text/html");

    debug(document.body.innerHTML);
  }
}

debug("webapp-l10n.js: End");
