'use strict';

function MockHistory(origin, type) {
  this.title = '';
  this.location = origin;
  this.loading = true;
  this.canGoBack = false;
  this.canGoForward = false;
  this.type = type;
  this.isHomescreen = false;
  this.isApp = (origin.indexOf('app://') != -1);
  this.painted = false;

  this.wrapper = {
    parentNode: {
      removeChild: (function() {
        this.mRemovedCalled = true;
      }).bind(this)
    }
  };
  this.iframe = null;
  this.cover = null;
}

MockHistory.prototype.free = function() {
  this.mFreeCalled = true;
};

MockHistory.prototype.close = function() {
  this.mCloseCalled = true;
};
