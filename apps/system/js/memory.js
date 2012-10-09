/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MemoryView = (function() {
  function log(str) {
    //dump(' +-+ MemoryView: ' + str + '\n');
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
    var request = storage.get('proc/meminfo');
    request.onsuccess = function onsuccess(e) {
      getFileContent(e.target.result, function onGetContent(content) {
        var lines = content.split('\n');
        for (var i in lines) {
          var line = lines[i];
          if (line.indexOf('MemFree') == 0) {
            element.innerHTML = 'f ' + line.split(/ +/)[1];
            return;
          }
        }
      });
    }

    request.onerror = function onerror(e) {
      log('Error retrieving /data/meminfo. Does it exists?');
    }
  }


  function getPIDForName(name, callback) {
    log('looking for ' + name);
    if (pids[name]) {
      callback(pids[name]);
      return;
    }

    // Bug XXXXXX - Infinite loop when reading /proc with the device storage API
    var storage = navigator.getDeviceStorage('apps');
    var request = storage.enumerate('proc');
    request.onsuccess = function onsuccess(e) {
      var pid = parseInt(e.target.result.name.split('/')[0]);
      if (!pid) {
        e.target.continue();
        return;
      }

      var storage2 = navigator.getDeviceStorage('apps');
      var stat = storage2.get('proc/' + pid + '/stat');

      stat.onsuccess = function onStatSuccess(evt) {
        var file = evt.target.result;
        getFileContent(file, function onStatContent(content) {
          if (content.indexOf(name) == -1) {
            e.target.continue();
            return;
          }

          pids[name] = parseInt(content.split(' ')[0]);
          callback(pids[name]);
        });
      }

      stat.onerror = function onStatError() {
        log('Error retrieving /proc/' + pid + '/stat. Does it exists?');
      }
    }

    request.onerror = function onerror() {
      log('Error retrieving /data/proc. Does it exists?');
    }
  }

  var pids = {};
  var currentName = 'Homescreen';

  function getUSS(element) {
    for (var p in pids) {
      log(p + ': ' + pids[p] + '\n');
    }

    getPIDForName(currentName, function onPID(pid) {
      getUsedMemory(pid, function(value) {
        element.innerHTML = 'u ' + value;
      });
    });
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

        window.addEventListener('appwillclose', function willclose(e) {
          currentName = 'Homescreen';
        });

        window.addEventListener('appwillopen', function willopen(e) {
          currentName = e.target.dataset.name;
          used.innerHTML = '00000';
        });

        window.addEventListener('appterminated', function terminated(e) {
          delete pids[e.detail.name];
        });

        window.clearInterval(interval);
        interval = window.setInterval(function updateMemory() {
          getFreeMemory(free);
          getUSS(used);
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
