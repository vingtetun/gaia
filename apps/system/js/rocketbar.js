'use strict';

var Rocketbar = {
  /**
   * Initialise rocketbar.
   */
  init: function rocketbar_init() {
    this.bar = document.getElementById('rocketbar');
    this.input = document.getElementById('rocketbar-input');
    this.results = document.getElementById('rocketbar-results');
    this.input.addEventListener('focus', this.handleFocus.bind(this));
    this.input.addEventListener('keyup', this.handleKeyUp.bind(this));
    this.results.addEventListener('click', this.handleClick.bind(this));
  },
  
  /**
   * Handle rocketbar focus.
   *
   * @param Event evt The focus event.
   */
  handleFocus: function rocketbar_handleFocus(evt) {
    this.input.select();
  },
  
  /**
   * Handle rocketbar key presses.
   *
   * @param Event evt The keyup event
   */
  handleKeyUp: function rocketbar_handleKeyUp(evt) {
    var results = [];
    
    // Clean up the query and display blank results if blank
    var query = this.input.value.toLowerCase().trim();
    if (query.length == 0) {
      this.showResults(results);
      return;
    }
    
    // Create a list of manifestURLs for apps with names which match the query
    var installedApps = Applications.installedApps;
    var manifestURLs = Object.keys(installedApps);
    manifestURLs.forEach(function(manifestURL) {
      var appName = installedApps[manifestURL].manifest.name.toLowerCase();
      if (appName.indexOf(query) != -1) {
        results.push(manifestURL);
      }
    }, this);
    this.showResults(results);
  },
  
  /**
   * Handle clicks on rocketbar results.
   *
   * @param Event evt Click event
   */
  handleClick: function rocketbar_handleClick(evt) {
    var manifestURL = evt.target.getAttribute('data-manifest-url');
    if (Applications.installedApps[manifestURL])
      Applications.installedApps[manifestURL].launch();
    UtilityTray.hide();
  },
  
  /**
   * Show rocketbar results for a list of app manifest URLs.
   *
   * @param Array results An array of app manifest URLs
   */
  showResults: function rocketbar_showResults(results) {
    this.results.innerHTML = '';
    if (results.length == 0)
      return;
    results.forEach(function(manifestURL) {
      var app = Applications.installedApps[manifestURL];
      var li = document.createElement('li');
      li.textContent = app.manifest.name;
      li.setAttribute('data-manifest-url', manifestURL);
      li.style.backgroundImage = 'url(' + app.origin +
        app.manifest.icons['60'] + ')'; 
      this.results.appendChild(li);
    }, this);
  }
};

window.addEventListener('load', function rocketbar_onLoad() {
  window.removeEventListener('load', rocketbar_onLoad);
  Rocketbar.init();
});

window.addEventListener('historychange', function rocketbar_onHistoryChange(e) {
  var history = e.detail.current;

  history.title;
  history.ontitlechange = function(title) {
  };

  history.location;
  history.onlocationchange = function(location) {
  };

  history.loading;
  history.onstatuschange = function(loading) {
  };

  history.canGoBack;
  history.oncangoback = function(canGoBack) {
  }

  history.type;
});
