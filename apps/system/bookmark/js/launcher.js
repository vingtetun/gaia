
'use strict';

var Launcher = (function() {

  var loading = document.getElementById('loading');

  var iframe = document.getElementById('app');
  iframe.addEventListener('mozbrowserloadstart', mozbrowserloadstart);
  iframe.addEventListener('mozbrowserloadend', mozbrowserloadend);

  var back = document.getElementById('back-button');

  var advertisement = document.getElementById('advertisement');

  function removeAdvertisement() {
    advertisement.parentNode.removeChild(advertisement);
  }

  setTimeout(removeAdvertisement, 4000);

  var toolbar = document.getElementById('toolbar');
  var toolbarTimeout;

  var isToolbarDisplayed = false;
  function toggleToolbar() {
    clearTimeout(toolbarTimeout);
    toolbar.classList.toggle('hidden');
    isToolbarDisplayed = !isToolbarDisplayed;
    if (isToolbarDisplayed) {
      toolbarTimeout = setTimeout(toggleToolbar, 3000);
    }
  }

  toolbar.addEventListener('mousedown', toggleToolbar);

  var inFullScreenMode = false;
  var full = document.getElementById('full-button');

  full.addEventListener('mousedown', function toggle(evt) {
    if (!inFullScreenMode) {
      iframe.mozRequestFullScreen();
    }
  });

  document.addEventListener('mozfullscreenchange', function fullLtr(event) {
    inFullScreenMode = !inFullScreenMode;
  });

  iframe.addEventListener('mozbrowsercontextmenu', function ctxmenu(event) {
    if (inFullScreenMode) {
      document.mozCancelFullScreen();
    }
  });

  var reload = document.getElementById('reload-button');

  reload.addEventListener('mousedown', function toggle(evt) {
    iframe.reload(true);
  });

  var locationchange = 0, currentURL;

  function locChange(evt) {
    locationchange++;

    if (locationchange === 0 || evt.detail === currentURL ||
        evt.detail === currentURL + '/') {
      locationchange = 0;
      back.dataset.disabled = true;
      back.removeEventListener('mousedown', goBack);
      return;
    }

    iframe.getCanGoBack().onsuccess = function(e) {
      if (e.target.result === true) {
        delete back.dataset.disabled;
        back.addEventListener('mousedown', goBack);
      } else {
        back.dataset.disabled = true;
        back.removeEventListener('mousedown', goBack);
      }
    }
  }

  function goBack(evt) {
    evt.stopPropagation();
    iframe.getCanGoBack().onsuccess = function(e) {
      if (e.target.result === true) {
        locationchange -= 2;
        iframe.goBack();
      }
    }
  }

  function mozbrowserloadstart() {
    loading.hidden = false;
  }

  function mozbrowserloadend() {
    loading.hidden = true;
  }

  window.addEventListener('message', function onMessage(e) {
    loading.hidden = false;
    back.dataset.disabled = true;
    iframe.src = currentURL = e.data;
    iframe.addEventListener('load', function end() {
      iframe.removeEventListener('load', end);
      iframe.addEventListener('mozbrowserlocationchange', locChange);
    });
  });
}());
