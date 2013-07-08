'use strict';

var WifiHelper = {
  // create a fake mozWifiManager if required (e.g. desktop browser)
  getWifiManager: function() {
    return navigator.mozWifiManager;
  }
};
