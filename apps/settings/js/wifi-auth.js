/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

// handle Wi-Fi settings
navigator.mozL10n.ready(function wifiSettings() {

  var _ = navigator.mozL10n.get;  
  var network = JSON.parse(window.location.hash.slice(1));

  var key = WifiHelper.getKeyManagement(network);
  var gWifiManager = WifiHelper.getWifiManager();
  var gCurrentNetwork = gWifiManager.connection.network;

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

  var dialog = document.getElementById('wifi-auth');
  var button = dialog.querySelector('button[type=submit]');

  // authentication fields
  var identity, password, showPassword;

  identity = dialog.querySelector('input[name=identity]');
  identity.value = network.identity || '';

  password = dialog.querySelector('input[name=password]');
  password.type = 'password';
  password.value = network.password || '';

  showPassword = dialog.querySelector('input[name=show-pwd]');
  showPassword.checked = false;
  showPassword.onchange = function() {
    password.type = this.checked ? 'text' : 'password';
  };

  // disable the "OK" button if the password is too short
  if (password) {
    var checkPassword = function checkPassword() {
      button.disabled = !WifiHelper.isValidInput(key, password.value, identity.value);
    };
    password.oninput = checkPassword;
    identity.oninput = checkPassword;
    checkPassword();
  }

  var keys = network.capabilities;
  var security = (keys && keys.length) ? keys.join(', ') : '';
  var sl = Math.min(Math.floor(network.relSignalStrength / 20), 4);
  dialog.querySelector('[data-ssid]').textContent = network.ssid;
  dialog.querySelector('[data-signal]').textContent =
      _('signalLevel' + sl);
  dialog.querySelector('[data-security]').textContent =
      security || _('securityNone');
  dialog.dataset.security = security;
  // OK|Cancel buttons
  button.addEventListener('click', function(e) {
    console.log('Click');
    e.preventDefault();
    if (key) {
      setPassword(password.value, identity.value);
    }
    wifiConnect();
  });
});

