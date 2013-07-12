/*
 * There are 2 transition related definitions to keep in sync:
   * the transforms in system.css use to snap in place
   * the as-you-go transforms in te _movingStyles method
 * */
var TransitionManager = (function() {
  'use strict';

  function debug(str) {
    console.log('TransitionManager: ' + str + '\n');
  }

  var current = null;
  window.addEventListener('historychange', function onHistoryChange(e) {
    var previous = current;
    current = e.detail.current;
    var forward = e.detail.forward;

    var prevWrapper = previous ? previous.wrapper : null;
    var curWrapper = current.wrapper;

    if (prevWrapper) {
      prevWrapper.classList.add('transitioning');
    }
    curWrapper.classList.add('transitioning');

    document.getElementById('screen').classList.remove('utility-tray');

    function afterTransition() {
      if (prevWrapper) {
        prevWrapper.classList.remove('transitioning');
        prevWrapper.style.MozTransition = '';
        prevWrapper.classList.remove('shadow');
        prevWrapper.style.zIndex = '';
      }

      curWrapper.style.MozTransition = '';
      curWrapper.classList.remove('shadow');
      curWrapper.classList.remove('forward');

      curWrapper.classList.remove('transitioning');
      curWrapper.style.zIndex = '';
    }

    var partial = !!curWrapper.style.MozTransition;
    if (forward) {
      curWrapper.classList.add('forward');
    } else {
      curWrapper.classList.remove('forward');
    }

    if (partial) {
      // Already in the middle of the transition
      if (prevWrapper) {
        delete prevWrapper.dataset.current;
      }
      curWrapper.dataset.current = true;
    } else {
      // Making sure we transition for the right position
      setTimeout(function nextTick() {
        if (prevWrapper) {
          if (previous && previous.isHomescreen && forward) {
            prevWrapper.style.MozTransition = 'opacity 0.2s linear';
          } else {
            prevWrapper.style.MozTransition = 'transform 0.2s linear 0.2s, opacity 0.2s linear 0.2s';
          }
          delete prevWrapper.dataset.current;
        }

        if (previous && previous.isHomescreen && forward) {
          curWrapper.style.MozTransition = 'opacity 0.4s linear';
        } else {
          curWrapper.style.MozTransition = 'transform 0.4s linear';
        }
        curWrapper.dataset.current = true;
      }, 100);
    }

    curWrapper.addEventListener('transitionend', function animWait(e) {
      if ((previous && !previous.isHomescreen) && e.propertyName != 'transform') {
        return;
      }
      curWrapper.removeEventListener('transitionend', animWait);

      if (current.isHomescreen) {
        document.getElementById('screen').classList.add('utility-tray');
      }

      setTimeout(function nextTick() {
        afterTransition();
      });
    });
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
  out: null,
  in: null,
  _inMovingStyles: null,
  _outMovingStyles: null,
  handleEvent: function navigation_handleEvent(e) {
    var forward = (e.target == this.next);
    var diffX = this.lastX - this.startX;
    var progress = Math.abs(diffX / window.innerWidth);

    switch(e.type) {
      case 'touchstart':
        this.lastX = this.startX = e.touches[0].pageX;
        this.lastDate = Date.now();

        var history = (forward ? WindowManager.getNext() :
                                 WindowManager.getPrevious());
        if (!history) {
          return;
        }

        var wrapper = history.wrapper;

        this.in = wrapper;
        this.out = WindowManager.getCurrent().wrapper;

        this.in.classList.add('transitioning');
        this.out.classList.add('transitioning');

        this._setStyles.apply(null, this._initialStyles(this.out, forward));
        this._setStyles.apply(null, this._initialStyles(this.in, forward));

        this._inMovingStyles = this._generateMovingStyles(this.out, forward);
        this._outMovingStyles = this._generateMovingStyles(this.in, forward);

        this.out.style.MozTransition = 'transform, opacity';
        this.in.style.MozTransition = 'transform, opacity';
        break;
      case 'touchmove':
        if (!this.in)
          return;

        this.lastX = e.touches[0].pageX;
        this.lastProgress = progress;
        this.lastDate = Date.now();

        this._setStyles.apply(null, this._inMovingStyles(progress));
        this._setStyles.apply(null, this._outMovingStyles(progress));
        break;
      case 'touchend':
        if (!this.in)
          return;

        var deltaT = Date.now() - this.lastDate;
        var deltaP = Math.abs(progress - this.lastProgress);
        var inertia = (deltaP / deltaT) * 100;

        var snapBack = true;
        if ((progress + inertia) >= 0.32) {
          forward ? WindowManager.goNext() : WindowManager.goBack();
          snapBack = false;
        }

        var progressToAnimate = snapBack ? progress : (1 - progress);
        var durationLeft = Math.min((progressToAnimate / deltaP) * deltaT, progressToAnimate * 500);

        this.out.style.MozTransition = this.in.style.MozTransition =
          'transform ' + durationLeft + 'ms linear, opacity ' + durationLeft + 'ms linear';

        this._clearStyles(this.out);
        this._clearStyles(this.in);

        this.out = this.in = null;
        break;
    }
  },

  _initialStyles: function t_initialStyles(wrapper, forward) {
    var zIndex, shadow;
    if (wrapper === this.out) {
      zIndex = forward ? 500 : 1000;
      shadow = forward ? false : true;
    } else {
      zIndex = forward ? 1000 : 500;
      shadow = forward ? true : false;
    }

    return [wrapper, null, null, null, zIndex, shadow];
  },

  _generateMovingStyles: function t_movingStyles(wrapper, forward) {
    return function(progress) {
      var translate = 0, scale = 1, opacity = 1;
      var remainingFactor = forward ? ((progress - 0.5) / 0.5) :
                                      ((0.5 - progress) / 0.5);
      var progressFactor = forward ? (100 - progress * 100) :
                                     (progress * 100);

      // back-to-front and front-to-back keyframes
      if ((wrapper == this.out && forward && progress >= 0.5) ||
          (wrapper !== this.out && !forward && progress <= 0.5)) {

        translate = (-20 * remainingFactor) + '%';
        opacity = 1 - 0.7 * remainingFactor;
        scale = 1 - 0.1 * remainingFactor;

        return [wrapper, translate, scale, opacity];
      }

      // left-to-right and right-to-left keyframes
      if ((wrapper == this.out && !forward) ||
          (wrapper !== this.out && forward)) {

        translate = 'calc(' + progressFactor + '% - 8px)';
      }

      return [wrapper, translate, scale, opacity];
    }
  },

  _setStyles: function t_setStyles(wrapper, translate, scale, opacity, zIndex, shadow) {
    if (translate && scale) {
      var transform = 'translateX(' + translate + ') scale(' + scale + ')';
      wrapper.style.MozTransform = transform;
    }
    if (opacity) {
      wrapper.style.opacity = opacity;
    }
    if (zIndex) {
      wrapper.style.zIndex = zIndex;
    }
    if (typeof shadow == "boolean") {
      if (shadow) {
        wrapper.classList.add('shadow');
      } else {
        wrapper.classList.remove('shadow');
      }
    }
  },

  _clearStyles: function t_clearStyles(wrapper) {
    wrapper.style.MozTransform = '';
    wrapper.style.opacity = '';
  }
};

PanelSwitcher.init();

var KeyboardHandler = {
  init: function kh_init() {
    window.addEventListener('keyboardchange', this);
    window.addEventListener('keyboardhide', this);
  },

  handleEvent: function kh_handleEvent(e) {
    var keyboardHeight = KeyboardManager.getHeight();
    WindowManager.resizeCurrentSheet(window.innerWidth,
                                     window.innerHeight - keyboardHeight);
  }
};

KeyboardHandler.init();
