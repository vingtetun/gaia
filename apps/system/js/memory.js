/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MemoryView = (function() {
  function log(str) {
    dump(' +-+ MemoryView: ' + str + '\n');
  }

  function getFileContent(file, callback) {
    var reader = new FileReader();
    reader.readAsText(file);

    reader.onloadend = function onloadend() {
      callback(reader.result);
    }
  }

  function getUsedMemory(pid, callback) {
    var storage = navigator.getDeviceStorage('apps');
    var request = storage.get('proc/' + pid + '/smaps');
    request.onsuccess = function(e) {
      getFileContent(e.target.result, function(content) {
        var lines = content.split('\n');
        var totalDirty = 0;
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf('Private_Dirty') != -1) {
            totalDirty += parseInt(line.split(/ +/)[1]);
          }
        }
        callback(totalDirty);
      });
    }

    request.onerror = function(e) {
      callback(null);
      log('Error retrieving /data/proc. Does it exists?');
    }
  }

  function getFreeMemory(element) {
    var storage = navigator.getDeviceStorage('apps');
    var request = storage.get('meminfo');
    request.onsuccess = function onsuccess(e) {
      getFileContent(e.target.result, function onGetContent(content) {
        var lines = content.split('\n');
        for (var i in lines) {
          var line = lines[i];
          if (line.indexOf('MemFree') == 0) {
            element.innerHTML = line.split(/ +/)[1];
            return;
          }
        }
      });
    }

    request.onerror = function onerror(e) {
      log('Error retrieving /data/meminfo. Does it exists?');
    }
  }

  function getPIDForName(element, name) {
    log('looking for ' + name);
    var storage = navigator.getDeviceStorage('apps');

    var request = storage.get('pids.txt');
    request.onsuccess = function onsuccess(e) {
      getFileContent(e.target.result, function onGetContent(content) {
        var lines = content.split('\n');
        for (var i in lines) {
          var line = lines[i];
          if (parseInt(line)) {
            var pid = parseInt(line);

            var storage2 = navigator.getDeviceStorage('apps');
            var stat = storage2.get('proc/' + pid + '/stat');

            stat.onsuccess = function onStatSuccess(e) {
              var file = e.target.result;
              getFileContent(file, function onStatContent(content) {
                if (content.indexOf(name) == -1)
                  return;

                var id = parseInt(content.split(' ')[0]);
                getUsedMemory(id, function(value) {
                  element.innerHTML = value;
                });
              });
            }

            stat.onerror = function onStatError() {
              log('Error retrieving /proc/' + pid +
                  '/stat. Does it exists?');
            }
          }
        }
      });
    }

    request.onerror = function onerror() {
      log('Error retrieving /data/proc. Does it exists?');
    }
  }


  var element = null;
  var interval = 0;

  return {
    get visible() {
      return element && element.style.display === 'block';
    },

    hide: function tv_hide() {
      if (element) {
        element.style.visibility = 'hidden';
        window.clearInterval(interval);
      }
    },

    show: function tv_show() {
      if (!element) {
        element = document.createElement('div');
        element.id = 'debug-memory';
        element.dataset.zIndexLevel = 'debug-memory';

        var free = document.createElement('span');
        free.innerHTML = '00000';

        var used = document.createElement('span');
        used.innerHTML = '00000';

        element.appendChild(free);
        element.appendChild(used);

        document.getElementById('screen').appendChild(element);

        window.clearInterval(this._interval);
        this._interval = window.setInterval(function updateMemory() {
          getFreeMemory(free);

          // XXX retrieve the current displayed application name
          getPIDForName(used, 'Homescreen');
        }, 1000);
      }

      element.style.visibility = 'visible';
    },

    toggle: function tv_toggle() {
      this.visible ? this.hide() : this.show();
    }
  }
})();

SettingsListener.observe('debug.memory.enabled', true, function(value) {
  !!value ? MemoryView.show() : MemoryView.hide();
});
