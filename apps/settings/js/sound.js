/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

(function() {

  'use strict';

  var Settings = {
    get: function(key, cb) {
      var request = navigator.mozSettings.createLock().get(key);
      request.onsuccess = function() {
        if (request.result[key] != undefined) {
          cb(request.result[key]);
        }
      };
    }
  }

  var button = document.getElementById('call-tone-selection');
  button.addEventListener('click', function(e) {
    window.open('sound-tone-selection.html');
    e.preventDefault();
  });

  // preset all checkboxes
  var rule = 'input[type="checkbox"]:not([data-ignore])';
  var checkboxes = document.querySelectorAll(rule);
  for (var i = 0; i < checkboxes.length; i++) {
    var key = checkboxes[i].name;
    (function(j) {
      Settings.get(key, function(value) {
        checkboxes[j].checked = !!value;
      });
    })(i);
  }

  bug344618_polyfill();

})();

