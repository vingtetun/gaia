/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MemoryView = {
  element: null,

  get visible() {
    return this.element && this.element.style.display === 'block';
  },

  hide: function tv_hide() {
    if (this.element) {
      this.element.style.visibility = 'hidden';
      window.clearInterval(this._interval);
    }
  },

  _interval: 0,
  show: function tv_show() {
    function getFreeMemory(element) {
      var storage = navigator.getDeviceStorage('apps');
      var request = storage.get('meminfo');
      request.onsuccess = function(e) {
        var file = e.target.result;
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onloadend = function onloadend(value) {
          var lines = reader.result.split('\n');
          for (var i in lines) {
            var line = lines[i];
            if (line.indexOf('MemFree') == 0) {
              element.innerHTML = line.split(/ +/)[1];
              return;
            }
          }
        }
      }

      request.onerror = function(e) {
        dump('MemoryView: error retrieving /data/meminfo. Does it exists?\n');
      }
    }

    var element = this.element;
    if (!element) {
      element = document.createElement('div');
      element.id = 'debug-memory';
      element.innerHTML = '00000';
      element.dataset.zIndexLevel = 'debug-memory';

      this.element = element;
      document.getElementById('screen').appendChild(element);

      window.clearInterval(this._interval);
      window.setInterval(function updateMemory() {
        getFreeMemory(element);
      }, 1000);
    }

    element.style.visibility = 'visible';
  },

  toggle: function tv_toggle() {
    this.visible ? this.hide() : this.show();
  }
};

SettingsListener.observe('debug.memory.enabled', true, function(value) {
  !!value ? MemoryView.show() : MemoryView.hide();
});

