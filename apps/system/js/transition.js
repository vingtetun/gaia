
var TransitionManager = (function() {
  'use strict';

  function debug(str) {
    console.log('TransitionManager: ' + str + '\n');
  }

  var current = { dataset: {}, setVisible: function() {} };

  window.addEventListener('historychange', function onHistoryChange(e) {
    current.dataset.current = false;
    current.dataset.previous = true;
    //current.setVisible(false);

    current = e.detail.current.iframe;

    current.dataset.current = true;
    current.dataset.previous = false;
    //current.setVisible(true);
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
