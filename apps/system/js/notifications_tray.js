/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var NotificationsTray = {
  shown: false,

  active: false,

  overlay: document.getElementById('notifications-tray'),

  statusbar: document.getElementById('bottom-panel'),

  screen: document.getElementById('screen'),

  init: function ut_init() {
    var touchEvents = ['touchstart', 'touchmove', 'touchend'];

    // XXX: Always use Mouse2Touch here.
    // We cannot reliably detect touch support normally
    // by evaluate (document instanceof DocumentTouch) on Desktop B2G.
    touchEvents.forEach(function bindEvents(name) {
      // window.addEventListener(name, this);
      Mouse2Touch.addEventHandler(window, name, this);
    }, this);

    window.addEventListener('screenchange', this);
    window.addEventListener('emergencyalert', this);
    window.addEventListener('attentionscreenshow', this);

    this.overlay.addEventListener('transitionend', this);
  },

  handleEvent: function ut_handleEvent(evt) {
    switch (evt.type) {
      case 'attentionscreenshow':
      case 'emergencyalert':
        if (this.shown) {
          this.hide();
        }
        break;

      case 'screenchange':
        if (this.shown && !evt.detail.screenEnabled)
          this.hide(true);

        break;

      case 'touchstart':
        if (LockScreen.locked)
          return;
        if (evt.target !== this.overlay &&
            evt.target !== this.statusbar)
          return;

        this.active = true;
        this.onTouchStart(evt.touches[0]);
        break;

      case 'touchmove':
      if (!this.active)
        return;

        this.onTouchMove(evt.touches[0]);
        break;

      case 'touchend':
        if (!this.active)
          return;

        this.active = false;
        this.onTouchEnd(evt.changedTouches[0]);
        break;

      case 'transitionend':
        if (!this.shown)
          this.screen.classList.remove('notifications-tray');
        break;
    }
  },

  onTouchStart: function ut_onTouchStart(touch) {
    this.startY = touch.pageY;

    this.screen.classList.add('notifications-tray');
    this.onTouchMove({ pageY: touch.pageY + this.statusbar.offsetHeight });
  },

  onTouchMove: function ut_onTouchMove(touch) {
    var screenHeight = this.overlay.getBoundingClientRect().height;
    var y = touch.pageY + screenHeight;
    if (y < this.lastY)
      this.opening = true;
    else if (y > this.lastY)
      this.opening = false;
    this.lastY = y;
    var dy = -(this.startY - y);
    if (this.shown)
      dy -= screenHeight;
    dy = Math.max(0, Math.min(screenHeight, dy));

    var style = this.overlay.style;
    style.MozTransition = '';
    style.MozTransform = 'translateY(' + dy + 'px)';
  },

  onTouchEnd: function ut_onTouchEnd(touch) {
    this.opening ? this.show() : this.hide();
  },

  hide: function ut_hide(instant) {
    var alreadyHidden = !this.shown;
    var style = this.overlay.style;
    style.MozTransition = instant ? '' : '-moz-transform 0.2s linear';
    style.MozTransform = 'translateY(100%)';
    this.shown = false;
    this.lastY = undefined;
    this.startY = undefined;

    if (!alreadyHidden) {
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('notificationstrayhide', true, true, null);
      window.dispatchEvent(evt);
    }
  },

  show: function ut_show(dy) {
    var alreadyShown = this.shown;
    var style = this.overlay.style;
    style.MozTransition = '-moz-transform 0.2s linear';
    style.MozTransform = 'translateY(0)';
    this.shown = true;
    this.screen.classList.add('notifications-tray');

    if (!alreadyShown) {
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('notificationstrayshow', true, true, null);
      window.dispatchEvent(evt);
    }
  }
};

NotificationsTray.init();
