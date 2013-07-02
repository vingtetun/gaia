/*
 * There 3 are transition related definitions to keep in sync:
*   * the full keyframes based animation in system.css
*   * the transforms in system.css use to snap in place
*   * the as-you-go transforms in te _movingStyles method
 * */
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
    var forward = e.detail.forward;
    var partial = e.detail.partial;

    function afterTransition() {
      previous.style.zIndex = '';
      current.style.zIndex = '';
      previous.classList.remove('shadow');
      current.classList.remove('shadow');

      current.classList.add('transitioned');
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
        }, 200);
      });
      current.setVisible(true);
    }

    current.classList.remove('transitioned');
    delete previous.dataset.current;
    if (forward) {
      current.classList.add('forward');
    } else {
      current.classList.remove('forward');
    }
    current.dataset.current = true;

    if (partial) {
      current.addEventListener('transitionend', function animWait(e) {
        current.removeEventListener('transitionend', animWait);

        afterTransition();
      });
    } else {
      previous.classList.remove('shadow');
      current.classList.add('shadow');

      previous.classList.add('animate');
      current.classList.add('animate');
      current.addEventListener('animationend', function animWait(e) {
        current.removeEventListener('animationend', animWait);

        previous.classList.remove('animate');
        current.classList.remove('animate');

        afterTransition();
      });
    }

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

var PanelSwitcher = {
  previous: document.getElementById('left-panel'),
  next: document.getElementById('right-panel'),

  init: function ps_init() {
    ['touchstart', 'touchmove', 'touchend'].forEach(function(e) {
      this.previous.addEventListener(e, this);
      this.next.addEventListener(e, this);
    }, this);
  },

  lastX: 0,
  lastDate: null,
  lastProgress: 0,
  frame: null,
  _frameMovingStyles: null,
  _currentMovingStyles: null,
  handleEvent: function navigation_handleEvent(e) {
    var forward = (e.target == this.next);
    var diffX = this.lastX - this.startX;
    var progress = Math.abs(diffX / window.innerWidth);

    switch(e.type) {
      case 'touchstart':
        this.lastX = this.startX = e.touches[0].pageX;
        this.lastDate = Date.now();

        var frame = (forward ? WindowManager.getNext().iframe :
                               WindowManager.getPrevious().iframe);
        if (!frame) {
          return;
        }

        this.frame = frame;
        this.current = WindowManager.getCurrent().iframe;

        this._setStyles.apply(null, this._initialStyles(this.frame, forward));
        this._setStyles.apply(null, this._initialStyles(this.current, forward));

        this._frameMovingStyles = this._generateMovingStyles(this.frame, forward);
        this._currentMovingStyles = this._generateMovingStyles(this.current, forward);

        this.frame.style.MozTransition = 'transform, opacity';
        this.current.style.MozTransition = 'transform, opacity';
        break;
      case 'touchmove':
        if (!this.frame)
          return;

        this.lastX = e.touches[0].pageX;
        this.lastProgress = progress;
        this.lastDate = Date.now();

        this._setStyles.apply(null, this._frameMovingStyles(progress));
        this._setStyles.apply(null, this._currentMovingStyles(progress));
        break;
      case 'touchend':
        if (!this.frame)
          return;

        var deltaT = Date.now() - this.lastDate;
        var deltaP = Math.abs(progress - this.lastProgress);
        var inertia = (deltaP / deltaT) * 100;

        var snapBack = true;
        if ((progress + inertia) >= 0.32) {
          forward ? WindowManager.goNext(true) : WindowManager.goBack(true);
          snapBack = false;
        }

        var progressToAnimate = snapBack ? progress : (1 - progress);
        var durationLeft = Math.min((progressToAnimate / deltaP) * deltaT, progressToAnimate * 500);

        this.frame.style.MozTransition = this.current.style.MozTransition =
          'transform ' + durationLeft + 'ms linear, opacity ' + durationLeft + 'ms linear';

        this._clearStyles(this.frame);
        this._clearStyles(this.current);

        this.frame = this.current = null;
        break;
    }
  },

  _initialStyles: function t_initialStyles(frame, forward) {
    var zIndex, shadow;
    if (frame === this.current) {
      zIndex = forward ? 500 : 1000;
      shadow = forward ? false : true;
    } else {
      zIndex = forward ? 1000 : 500;
      shadow = forward ? true : false;
    }

    return [frame, null, null, null, zIndex, shadow];
  },

  _generateMovingStyles: function t_movingStyles(frame, forward) {
    return function(progress) {
      var translate = 0, scale = 1, opacity = 1;
      var remainingFactor = forward ? ((progress - 0.5) / 0.5) :
                                      ((0.5 - progress) / 0.5);
      var progressFactor = forward ? (100 - progress * 100) :
                                     (progress * 100);

      // back-to-front and front-to-back keyframes
      if ((frame == this.current && forward && progress >= 0.5) ||
          (frame !== this.current && !forward && progress <= 0.5)) {

        translate = (-20 * remainingFactor) + '%';
        opacity = 1 - 0.7 * remainingFactor;
        scale = 1 - 0.1 * remainingFactor;

        return [frame, translate, scale, opacity];
      }

      // left-to-right and right-to-left keyframes
      if ((frame == this.current && !forward) ||
          (frame !== this.current && forward)) {

        translate = 'calc(' + progressFactor + '% - 8px)';
      }

      return [frame, translate, scale, opacity];
    }
  },

  _setStyles: function t_setStyles(frame, translate, scale, opacity, zIndex, shadow) {
    if (translate && scale) {
      var transform = 'translateX(' + translate + ') scale(' + scale + ')';
      frame.style.MozTransform = transform;
    }
    if (opacity) {
      frame.style.opacity = opacity;
    }
    if (zIndex) {
      frame.style.zIndex = zIndex;
    }
    if (typeof shadow == "boolean") {
      if (shadow) {
        frame.classList.add('shadow');
      } else {
        frame.classList.remove('shadow');
      }
    }
  },

  _clearStyles: function t_clearStyles(frame) {
    frame.style.MozTransform = '';
    frame.style.opacity = '';
  }
};

PanelSwitcher.init();
