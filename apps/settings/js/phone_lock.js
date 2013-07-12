/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var PhoneLock = {

  settings: {
    passcodeEnable: false
  },

  getAllElements: function pl_getAllElements() {
    this.lockscreenEnable = document.getElementById('lockscreen-enable');
    this.passcodeEnable = document.getElementById('passcode-enable');
    this.passcodeEditButton = document.getElementById('passcode-edit');
    this.phonelockPanel = document.getElementById('phoneLock');
  },

  init: function pl_init() {
    fakeSelector();
    this.getAllElements();
    this.passcodeEnable.addEventListener('click', this);
    this.passcodeEditButton.addEventListener('click', this);
    this.fetchSettings();
  },

  fetchSettings: function pl_fetchSettings() {
    var self = this;
    Accessor.get('lockscreen.enabled', function(enable) {
      self.phonelockPanel.dataset.lockscreenEnabled = enable;
      self.lockscreenEnable.checked = enable;
    });
    Accessor.sync('lockscreen.enabled', function(isEnabled) {
        self.phonelockPanel.dataset.lockscreenEnabled = isEnabled;
    });
    Accessor.get('lockscreen.passcode-lock.enabled', function(enable) {
      self.settings.passcodeEnable = enable;
      self.phonelockPanel.dataset.passcodeEnabled = enable;
      self.passcodeEnable.checked = enable;
    });
    Accessor.sync('lockscreen.passcode-lock.enabled', function(isEnabled) {
      self.settings.passcodeEnable = isEnabled;
      self.phonelockPanel.dataset.passcodeEnabled = isEnabled;
      self.passcodeEnable.checked = isEnabled;
    });
  },

  changeMode: function pl_changeMode(mode) {
    window.open('phone-lock-passcode.html#'+mode);
  },

  handleEvent: function pl_handleEvent(evt) {
    switch (evt.target) {
      case this.passcodeEnable:
        evt.preventDefault();
        if (this.settings.passcodeEnable) {
          this.changeMode('confirm');
        } else {
          this.changeMode('create');
        }
        break;
      case this.passcodeEditButton:
        this.changeMode('edit');
        break;
    }
  }
};

// startup
navigator.mozL10n.ready(PhoneLock.init.bind(PhoneLock));
