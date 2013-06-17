'use strict';

var Rocketbar = {
  init: function rocketbar_init() {
    this.bar = document.getElementById('rocketbar');
    this.input = document.getElementById('rocketbar-input');
    this.results = document.getElementById('rocketbar-results');
    this.input.addEventListener('focus', this.handleFocus.bind(this));
    this.input.addEventListener('keyup', this.handleKeyUp.bind(this));
  },
  
  handleFocus: function rocketbar_handleFocus(evt) {
    this.input.select();
  },
  
  handleKeyUp: function rocketbar_handleKeyUp(evt) {
    var results = [];
    var query = this.input.value.toLowerCase().trim();
    if (query.length == 0) {
      this.showResults(results);
      return;
    }
    var installedApps = Applications.installedApps;
    var manifestURLs = Object.keys(installedApps);
    manifestURLs.forEach(function(manifestURL) {
      var appName = installedApps[manifestURL].manifest.name.toLowerCase();
      if (appName.indexOf(query) != -1) {
        results.push(installedApps[manifestURL].manifest.name);
      }
    });
    this.showResults(results);
  },
  
  showResults: function rocketbar_showResults(results) {
    this.results.innerHTML = '';
    if (results.length == 0)
      return;
    for (var i in results) {
      var li = document.createElement('li');
      li.textContent = results[i];
      this.results.appendChild(li);
    }
  }
};

window.addEventListener('load', function rocketbar_onLoad() {
  window.removeEventListener('load', rocketbar_onLoad);
  Rocketbar.init();
});