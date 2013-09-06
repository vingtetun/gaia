/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var ContextMenu = {
  init: function cm_init() {
    window.addEventListener('mozbrowsercontextmenu', this, true);
  },

  handleEvent: function cm_handleEvent(evt) {
    var detail = evt.detail;

    var items = [];
    detail.systemTargets.forEach(function(item) {
      if (item.nodeName == 'A') {
        items.push({
          label: 'Open In New Sheet',
          value: item.data.uri
        });
      }
    });

    if (!items.length)
      return;

    var iframe = evt.target;
    var onsuccess = function(action) {
      WindowManager.openNewSheet(action, evt.target.getAttribute('mozapp'));
    };

    ListMenu.request(items, '', onsuccess);
    evt.preventDefault();
  }
};

ContextMenu.init();
