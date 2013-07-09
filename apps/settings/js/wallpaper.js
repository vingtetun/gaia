/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var Wallpaper = {

  button: document.getElementById('wallpaper-button'),
  preview: document.getElementById('wallpaper-preview'),

  init: function wallpaper_init() {
    this.loadCurrentWallpaper();
    this.bindEvent();

    initSettingsCheckbox();
    fakeSelector();
    bug344618_polyfill();
  },

  setWallpaper: function wallpaper_setWallpaper(wallpaper_path) {
    this.preview.src = wallpaper_path;
  },

  loadCurrentWallpaper: function wallpaper_loadCurrentWallpaper() {
    Accessor.sync('wallpaper.image', this.setWallpaper.bind(this));
    Accessor.get('wallpaper.image', this.setWallpaper.bind(this));
  },

  onWallpaperClick: function wallpaper_onWallpaperClick() {
    var self = this;
    var a = new MozActivity({
      name: 'pick',
      data: {
        type: 'image/jpeg',
        width: 320,
        height: 480
      }
    });

    a.onsuccess = function onPickSuccess() {
      if (!a.result.blob)
        return;

      var reader = new FileReader();
      reader.readAsDataURL(a.result.blob);
      reader.onload = function() {
        self.setWallpaper(reader.result);
        Accessor.set({ 'wallpaper.image': reader.result });
      };
    };
    a.onerror = function onPickError() {
      console.warn('pick failed!');
    };
  },

  bindEvent: function wallpaper_bindEvent() {
    this.preview.addEventListener('click', this.onWallpaperClick.bind(this));
    this.button.addEventListener('click', this.onWallpaperClick.bind(this));
  }
};

Wallpaper.init();

