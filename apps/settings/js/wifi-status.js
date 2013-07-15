(function() {

  'use strict';

  var _ = navigator.mozL10n.get;
  var gWifiManager = WifiHelper.getWifiManager();
  var network = JSON.parse(window.location.hash.slice(1));

  var keys = WifiHelper.getSecurity(network);
  var security = (keys && keys.length) ? keys.join(', ') : '';
  var sl = Math.min(Math.floor(network.relSignalStrength / 20), 4);

  var WifiStatus = {

    ipAddress: document.querySelector('[data-ip]'),
    speed: document.querySelector('[data-speed]'),
    signal: document.querySelector('[data-signal]'),
    security: document.querySelector('[data-security]'),
    button: document.querySelector('button'),

    updateNetInfo: function() {
      var info = gWifiManager.connectionInformation;
      this.ipAddress.textContent = info.ipAddress || '';
      this.speed.textContent =
          _('linkSpeedMbs', { linkSpeed: info.linkSpeed });
      this.signal.textContent = _('signalLevel' + sl);
      this.security.textContent = security || _('securityNone');
    },

    forget: function() {
      gWifiManager.forget(network);
      window.close();
    },

    init: function() {
      // we're connected, let's display some connection info
      gWifiManager.connectionInfoUpdate = this.updateNetInfo.bind(this);
      this.updateNetInfo();

      // Forget button
      this.button.addEventListener('click', this.forget.bind(this));
    }

  };

  navigator.mozL10n.ready(WifiStatus.init.bind(WifiStatus));

})();
