(function() {

  'use strict';

  var _ = navigator.mozL10n.get;
  var gWifiManager = WifiHelper.getWifiManager();

  var WifiJoinHidden = {

    button: document.querySelector('button[type=submit]'),

    init: function() {

      fakeSelector();

      var security = document.querySelector('select');
      var onSecurityChange = function() {
        key = security.selectedIndex ? security.value : '';
        WifiHelper.setSecurity(network, [key]);
        checkPassword();
      };
      security.onchange = onSecurityChange;
      onSecurityChange();

      function wifiConnect() {
        gCurrentNetwork = network;
        gWifiManager.associate(network);
        Accessor.set({
          'wifi.connect_via_settings': true
        }, function() {
          window.close();
        });
      }

      function setPassword(password, identity) {
        var key = WifiHelper.getKeyManagement(network);
        if (key == 'WEP') {
          network.wep = password;
        } else if (key == 'WPA-PSK') {
          network.psk = password;
        } else if (key == 'WPA-EAP') {
          network.password = password;
          if (identity && identity.length) {
            network.identity = identity;
          }
        }
        network.keyManagement = key;
      }

      var identity, password, showPassword;

      identity = document.querySelector('input[name=identity]');
      identity.value = network.identity || '';

      password = document.querySelector('input[name=password]');
      password.type = 'password';
      password.value = network.password || '';

      showPassword = document.querySelector('input[name=show-pwd]');
      showPassword.checked = false;
      showPassword.onchange = function() {
        password.type = this.checked ? 'text' : 'password';
      };

      network.hidden = true;

      if (password) {
        var checkPassword = function checkPassword() {
          document.querySelector('button[type=submit]').disabled =
            !WifiHelper.isValidInput(key, password.value, identity.value);
        };
        password.oninput = checkPassword;
        identity.oninput = checkPassword;
        checkPassword();
      }

      this.button.addEventListener('click', function(e) {
        e.preventDefault();
        if (key) {
          setPassword(password.value, identity.value);
        }
        wifiConnect();
      });
    }

  };

  navigator.mozL10n.ready(WifiJoinHidden.init.bind(WifiJoinHidden));

})();