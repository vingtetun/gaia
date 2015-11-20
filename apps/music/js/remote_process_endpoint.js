'use strict';

var RemoteProcess = function(keyword) {
  this._callbacks = {};

  this.ready = new Promise((resolve, reject) => {
    navigator.mozApps.getSelf().onsuccess = (event) => {
      var app = event.target.result;
      if (!app) {
        reject();
        return;
      }

      app.connect(keyword).then(ports => {
        var port;
        ports.forEach(interAppPort => {
          port = interAppPort;
        });

        port.onmessage = (msg) => {
          var data = msg.data;
          var callback = this._callbacks[data.uuid];
          callback && callback(data);
        }

        resolve(port);
      }, reject);
    };
  });
};

RemoteProcess.prototype.uuid = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

RemoteProcess.prototype.postMessage = function(url, transfer) {
  var data = {
    uuid: this.uuid(),
    url: url
  };

  return this.ready.then((port) => {
    console.log('RemoteProcess postMessage: ' + data);
    port.postMessage(data);

    return new Promise((resolve, reject) => {
      this._callbacks[data.uuid] = function(data) {
        resolve({
          blob: () => Promise.resolve(data.blob),
          json: () => Promise.resolve(data.json)
        });
      }
    });

  });
};

RemoteProcess.prototype.addEventListener = function(evtType, callback) {
  this._callbacks[evtType] = callback;
}

RemoteProcess.prototype.removeEventListener = function(evtType, callback) {
  delete this._callbacks[evtType];
}
