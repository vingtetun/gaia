/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

(function() {

  'use strict';

  var button = document.getElementById('call-tone-selection');
  button.addEventListener('click', function(e) {
    window.open('sound-tone-selection.html');
    e.preventDefault();
  });

  initSettingsCheckbox();
  bug344618_polyfill();

})();

