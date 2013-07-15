(function() {

  'use strict';

  var _ = navigator.mozL10n.get;
  var gWifiManager = WifiHelper.getWifiManager();

  var gWpsInfoBlock = document.querySelector('#wps-column small');
  var gWpsPbcLabelBlock = document.querySelector('#wps-column a');
  var gWpsInProgress = false;

  var WifiWps = {

    updateNetworkState: function() {
      var networkStatus = gWifiManager.connection.status;
      if (gWpsInProgress) {
        if (networkStatus !== 'disconnected') {
          gWpsInfoBlock.textContent = gWifiInfoBlock.textContent;
        }
        if (networkStatus === 'connected' ||
            networkStatus === 'wps-timedout' ||
            networkStatus === 'wps-failed' ||
            networkStatus === 'wps-overlapped') {
          gWpsInProgress = false;
          gWpsPbcLabelBlock.textContent = _('wpsMessage');
          gWpsPbcLabelBlock.dataset.l10nId = 'wpsMessage';
        }
      }
    },

    init: function() {
      if (gWpsInProgress) {
        var req = gWifiManager.wps({
          method: 'cancel'
        });
        req.onsuccess = function() {
          gWpsInProgress = false;
          gWpsPbcLabelBlock.textContent = _('wpsMessage');
          gWpsPbcLabelBlock.dataset.l10nId = 'wpsMessage';
          gWpsInfoBlock.textContent = _('fullStatus-wps-canceled');
          gWpsInfoBlock.dataset.l10nId = 'fullStatus-wps-canceled';
        };
        req.onerror = function() {
          gWpsInfoBlock.textContent = _('wpsCancelFailedMessage') +
            ' [' + req.error.name + ']';
        };
      } else {
        wpsDialog('wifi-wps', wpsCallback);
      }

      function wpsCallback(method, pin) {
        var req;
        if (method === 'pbc') {
          req = gWifiManager.wps({
            method: 'pbc'
          });
        } else if (method === 'myPin') {
          req = gWifiManager.wps({
            method: 'pin'
          });
        } else {
          req = gWifiManager.wps({
            method: 'pin',
            pin: pin
          });
        }
        req.onsuccess = function() {
          if (method === 'myPin') {
            alert(_('wpsPinInput', { pin: req.result }));
          }
          gWpsInProgress = true;
          gWpsPbcLabelBlock.textContent = _('wpsCancelMessage');
          gWpsPbcLabelBlock.dataset.l10nId = 'wpsCancelMessage';
          gWpsInfoBlock.textContent = _('fullStatus-wps-inprogress');
          gWpsInfoBlock.dataset.l10nId = 'fullStatus-wps-inprogress';
        };
        req.onerror = function() {
          gWpsInfoBlock.textContent = _('fullStatus-wps-failed') +
            ' [' + req.error.name + ']';
        };
      }

      function wpsDialog(dialogID, callback) {
        var dialog = document.getElementById(dialogID);
        if (!dialog)
          return;

        // hide dialog box
        function pinChecksum(pin) {
          var accum = 0;
          while (pin > 0) {
            accum += 3 * (pin % 10);
            pin = Math.floor(pin / 10);
            accum += pin % 10;
            pin = Math.floor(pin / 10);
          }
          return (10 - accum % 10) % 10;
        }

        function isValidWpsPin(pin) {
          if (pin.match(/[^0-9]+/))
            return false;
          if (pin.length === 4)
            return true;
          if (pin.length !== 8)
            return false;
          var num = pin - 0;
          return pinChecksum(Math.floor(num / 10)) === (num % 10);
        }

        var submitWpsButton = document.querySelector('button[type=submit]');
        var pinItem = document.getElementById('wifi-wps-pin-area');
        var pinDesc = pinItem.querySelector('p');
        var pinInput = pinItem.querySelector('input');
        pinInput.oninput = function() {
          submitWpsButton.disabled = !isValidWpsPin(pinInput.value);
        };

        function onWpsMethodChange() {
          var method =
            document.querySelector("input[type='radio']:checked").value;
          if (method === 'apPin') {
            submitWpsButton.disabled = !isValidWpsPin(pinInput.value);
            pinItem.hidden = false;
          } else {
            submitWpsButton.disabled = false;
            pinItem.hidden = true;
          }
        }

        var radios = document.querySelectorAll('input[type="radio"]');
        for (var i = 0; i < radios.length; i++) {
          radios[i].onchange = onWpsMethodChange;
        }
        onWpsMethodChange();

        openDialog(dialogID, function submit() {
          callback(dialog.querySelector("input[type='radio']:checked").value,
            pinInput.value);
        });
      }
      
    }

  };

  navigator.mozL10n.ready(WifiWps.init.bind(WifiWps));

})();