
var TransitionManager = (function() {
  'use strict';

  function debug(str) {
    console.log('TransitionManager: ' + str + '\n');
  }

  var current = {
    dataset: {},
    getScreenshot: function() {
      var request = {};
      setTimeout(function() { request.onerror(); }, 500);
      return request;
    },
    setVisible: function() {}
  };

  window.addEventListener('historychange', function onHistoryChange(e) {
      var previous = current;
      current = e.detail.current.iframe;

      setTimeout(function() {
        delete previous.dataset.current;
        current.dataset.current = true;

        current.addEventListener('transitionend', function(e) {
          previous.setVisible(false);

          var div = document.getElementById('screenshot');
          if (!div) {
            div = document.createElement('div');
            div.id = 'screenshot';
            document.body.appendChild(div);
          }
          div.style.backgroundImage = current.style.backgroundImage;
          div.style.display = 'block';

          current.addNextPaintListener(function onNextPaint() {
            current.removeNextPaintListener(onNextPaint);
            setTimeout(function() { 
              current.style.backgroundImage = '';
              document.getElementById('screenshot').style.display = 'none';
            });
          });
          current.setVisible(true);
        });
      });

      var request = previous.getScreenshot(window.innerWidth, window.innerHeight);
      request.onsuccess = function(e) {
        if (e.target.result) {
          previous.style.backgroundImage = 'url(' + URL.createObjectURL(e.target.result) + ')';
        }
      };

      request.onerror = function(e) {
      }
  });
})();

var BackGesture = {
  previous: document.getElementById('left-panel'),

  init: function navigation_init() {
    // XXX The gesture should be a complex calculation in order to avoid fake positive.
    this.previous.addEventListener('touchstart', this);
    this.previous.addEventListener('touchmove', this);
    this.previous.addEventListener('touchend', this);
  },

  lastX: 0,
  pageX: 0,
  frame: null,
  handleEvent: function navigation_handleEvent(e) {
    switch(e.type) {
      case 'touchstart':
        this.pageX = this.startX = e.touches[0].pageX;

        var previous = WindowManager.getPrevious().iframe;
        if (!previous) {
          return;
        }

        this.frame = previous;
        this.current = WindowManager.getCurrent().iframe;

        this.frame.style.MozTransform = '';
        this.current.style.MozTransform = '';
        this.frame.style.MozTransition = 'e';
        this.current.style.MozTransition = 'e';
        break;
      case 'touchmove':
        if (!this.frame)
          return;

        this.pageX = e.touches[0].pageX;
        this.frame.style.MozTransform = 'translateX(' + (-window.innerWidth +  this.pageX - this.startX) + 'px)';
        this.current.style.MozTransform = 'translateX(' + (this.pageX - this.startX) + 'px)';
        break;
      case 'touchend':
        if (!this.frame)
          return;

        var diffX = (this.pageX - this.startX);
        if (diffX >= window.innerWidth / 2.5) {
          WindowManager.goBack();
        }

        this.frame.style.MozTransform = '';
        this.current.style.MozTransform = '';
        this.frame.style.MozTransition = '';
        this.current.style.MozTransition = '';
        this.frame = this.current = null;
        break;
    }
  }
};

BackGesture.init();


var ForwardGesture = {
  next: document.getElementById('right-panel'),

  init: function navigation_init() {
    // XXX The gesture should be a complex calculation in order to avoid fake positive.
    this.next.addEventListener('touchstart', this);
    this.next.addEventListener('touchmove', this);
    this.next.addEventListener('touchend', this);
  },

  lastX: 0,
  pageX: 0,
  frame: null,
  handleEvent: function navigation_handleEvent(e) {
    switch(e.type) {
      case 'touchstart':
        this.pageX = this.startX = e.touches[0].pageX;

        var next = WindowManager.getNext().iframe;
        if (!next) {
          return;
        }

        this.frame = next;
        this.current = WindowManager.getCurrent().iframe;

        this.frame.style.MozTransform = '';
        this.current.style.MozTransform = '';
        this.frame.style.MozTransition = 'e';
        this.current.style.MozTransition = 'e';
        break;
      case 'touchmove':
        if (!this.frame)
          return;

        this.pageX = e.touches[0].pageX;
        this.frame.style.MozTransform = 'translateX(' + (window.innerWidth +  this.pageX - this.startX) + 'px)';
        this.current.style.MozTransform = 'translateX(' + (this.pageX - this.startX) + 'px)';
        break;
      case 'touchend':
        if (!this.frame)
          return;

        var diffX = (this.startX - this.pageX);
        if (diffX >= window.innerWidth / 2.5) {
          WindowManager.goNext();
        }

        this.frame.style.MozTransform = '';
        this.current.style.MozTransform = '';
        this.frame.style.MozTransition = '';
        this.current.style.MozTransition = '';
        this.frame = this.current = null;
        break;
    }
  }
};

ForwardGesture.init();
