'use strict';

var KeyboardManager = (function() {
  function getKeyboardURL() {
    // TODO: Retrieve it from Settings, allowing 3rd party keyboards
    var host = document.location.host;
    var domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2');
    var protocol = document.location.protocol;

    return protocol + '//keyboard.' + domain + '/index.html';;
  }

  function generateKeyboard(contaimer, keyboardURL, manifestURL) {
    var keyboard = document.createElement('iframe');
    keyboard.src = keyboardURL;
    keyboard.setAttribute('mozbrowser', 'true');
    keyboard.setAttribute('mozapp', manifestURL);
    //keyboard.setAttribute('remote', 'true');

    container.appendChild(keyboard);
    return keyboard;
  }

  // Generate a <iframe mozbrowser> containing the keyboard.
  var container = document.getElementById('keyboard-frame');
  var keyboardURL = getKeyboardURL();
  var manifestURL = keyboardURL.replace('index.html', 'manifest.webapp');
  var keyboard = generateKeyboard(container, keyboardURL, manifestURL);

  // The overlay will display part of the keyboard that are below the
  // current application.
  var overlay = document.getElementById('keyboard-overlay');

  // Listen for mozbrowserlocationchange of keyboard iframe.
  var previousHash = '';

  var a = document.createElement('a');
  keyboard.addEventListener('mozbrowserlocationchange', function(e) {
    a.href = e.detail;
    if (previousHash == a.hash)
      return;
    previousHash = a.hash;

    var type = a.hash.split('=');
    switch (type[0]) {
      case '#show':
        var size = parseInt(type[1]);
        var height = window.innerHeight - size;
        overlay.hidden = false;

        var updateHeight = function() {
          container.removeEventListener('transitionend', updateHeight);
          overlay.style.height = height + 'px';
          container.classList.add('visible');

          var detail = {
            'detail': {
              'height': size
            }
          };
          dispatchEvent(new CustomEvent('keyboardchange', detail));
        }

        if (container.classList.contains('hide')) {
          container.classList.remove('hide');
          container.addEventListener('transitionend', updateHeight);
          return;
        }

        updateHeight();
        break;

      case '#hide':
        container.classList.add('hide');
        container.classList.remove('visible');
        overlay.hidden = true;
        dispatchEvent(new CustomEvent('keyboardhide'));
        break;
    }
  });
})();

