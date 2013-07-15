(function() {

  'use strict';

  var _ = navigator.mozL10n.get;
  var gWifiManager = WifiHelper.getWifiManager();

  // saved network list
  var gKnownNetworkList = (function knownNetworkList(list) {

    // create an explanatory list item
    function newExplanationItem(message) {
      var li = document.createElement('li');
      li.className = 'explanation';
      li.textContent = _(message);
      return li;
    }

    function isConnected(network) {
      /**
       * XXX the API should expose a 'connected' property on 'network',
       * and 'gWifiManager.connection.network' should be comparable to 'network'.
       * Until this is properly implemented, we just compare SSIDs to tell wether
       * the network is already connected or not.
       */
      var currentNetwork = gWifiManager.connection.network;
      if (!currentNetwork)
        return false;
      var key = network.ssid + '+' +
        WifiHelper.getSecurity(network).join('+');
      var curkey = currentNetwork.ssid + '+' +
        WifiHelper.getSecurity(currentNetwork).join('+');
      return (key == curkey);
    }

    // create a network list item
    function newListItem(network, callback) {
      /**
       * A Wi-Fi list item has the following HTML structure:
       *   <li>
       *     <aside class="pack-end wifi-icon level-[?] [secured]"></aside>
       *     <small> Network Security </small>
       *     <a> Network SSID </a>
       *   </li>
       */

      // icon
      var icon = document.createElement('aside');
      icon.classList.add('pack-end');
      icon.classList.add('wifi-icon');
      var level = Math.min(Math.floor(network.relSignalStrength / 20), 4);
      icon.classList.add('level-' + level);

      // ssid
      var ssid = document.createElement('a');
      ssid.textContent = network.ssid;

      // supported authentication methods
      var small = document.createElement('small');
      var keys = WifiHelper.getSecurity(network);
      if (keys && keys.length) {
        small.textContent = _('securedBy', { capabilities: keys.join(', ') });
        icon.classList.add('secured');
      } else {
        small.textContent = _('securityOpen');
      }

      // create list item
      var li = document.createElement('li');
      li.appendChild(icon);
      li.appendChild(small);
      li.appendChild(ssid);

      // Show connection status
      icon.classList.add('wifi-signal');
      if (isConnected(network)) {
        small.textContent = _('shortStatus-connected');
        icon.classList.add('connected');
        li.classList.add('active');
      }

      // bind connection callback
      li.onclick = function() {
        callback(network);
      };
      return li;
    }

    // clear the network list
    function clear() {
      while (list.hasChildNodes()) {
        list.removeChild(list.lastChild);
      }
    }

    // propose to forget a network
    function forgetNetwork(network) {
      var dialog = document.querySelector('form');
      dialog.hidden = false;
      dialog.onsubmit = function forget() {
        gWifiManager.forget(network);
        scan();
        dialog.hidden = true;
        return false;
      };
      dialog.onreset = function cancel() {
        dialog.hidden = true;
        return false;
      };
    }

    // list known networks
    function scan() {
      var req = gWifiManager.getKnownNetworks();

      req.onsuccess = function onSuccess() {
        var allNetworks = req.result;
        var networks = {};
        for (var i = 0; i < allNetworks.length; ++i) {
          var network = allNetworks[i];
          // use ssid + capabilities as a composited key
          var key = network.ssid + '+' +
            WifiHelper.getSecurity(network).join('+');
          networks[key] = network;
        }
        var networkKeys = Object.getOwnPropertyNames(networks);
        clear();

        // display network list
        if (networkKeys.length) {
          networkKeys.sort();
          for (var i = 0; i < networkKeys.length; i++) {
            var aItem = newListItem(networks[networkKeys[i]], forgetNetwork);
            list.appendChild(aItem);
          }
        } else {
          // display a "no known networks" message if necessary
          list.appendChild(newExplanationItem('noKnownNetworks'));
        }
      };

      req.onerror = function onScanError(error) {
        console.warn('wifi: could not retrieve any known network. ');
      };
    }

    // API
    return {
      clear: clear,
      scan: scan
    };

  }) (document.getElementById('wifi-knownNetworks'));

  var WifiManageNetworks = {

    init: function() {
      gKnownNetworkList.scan();
      document.getElementById('joinHidden').addEventListener('click', function() {
        window.open('wifi-join-hidden.html#' + JSON.stringify({}));
      });
    }

  };

  navigator.mozL10n.ready(WifiManageNetworks.init.bind(WifiManageNetworks));

})();
