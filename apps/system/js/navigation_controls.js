
'use strict';

var NavigationControls = {
  goBack: function nc_goBack() {
    var app = WindowManager.getDisplayedApp();
    if (app) {
      var frame = WindowManager.getAppFrame(app);
      frame.goBack();
    }
  },

  goForward: function nc_goForward() {
    var app = WindowManager.getDisplayedApp();
    if (app) {
      var frame = WindowManager.getAppFrame(app);
      frame.goForward();
    }
  }
};
