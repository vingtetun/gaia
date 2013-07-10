/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/**
 * Constants
 */

var DEBUG = false;

/**
 * Debug method
 */

function debug(msg, optObject) {
  if (DEBUG) {
    var output = '[DEBUG # Settings] ' + msg;
    if (optObject) {
      output += JSON.stringify(optObject);
    }
    console.log(output);
  }
}

/**
 * Move settings to foreground
 */

function reopenSettings() {
  navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
    var app = evt.target.result;
    app.launch('settings');
  };
}

/**
 * Open a link with a web activity
 */

function openLink(url) {
  if (url.startsWith('tel:')) { // dial a phone number
    new MozActivity({
      name: 'dial',
      data: { type: 'webtelephony/number', number: url.substr(4) }
    });
  } else if (!url.startsWith('#')) { // browse a URL
    new MozActivity({
      name: 'view',
      data: { type: 'url', url: url }
    });
  }
}

/**
 * These so-called "dialog boxes" are just standard Settings panels (<section
 * role="region" />) with reset/submit buttons: these buttons both return to the
 * previous panel when clicked, and each button has its own (optional) callback.
 */

function openDialog(dialogID, onSubmit, onReset) {
  if ('#' + dialogID == Settings.currentPanel)
    return;

  var origin = Settings.currentPanel;
  var dialog = document.getElementById(dialogID);

  var submit = dialog.querySelector('[type=submit]');
  if (submit) {
    submit.onclick = function onsubmit() {
      if (onSubmit)
        (onSubmit.bind(dialog))();
      Settings.currentPanel = origin; // hide dialog box
    };
  }

  var reset = dialog.querySelector('[type=reset]');
  if (reset) {
    reset.onclick = function onreset() {
      if (onReset)
        (onReset.bind(dialog))();
      Settings.currentPanel = origin; // hide dialog box
    };
  }

  Settings.currentPanel = dialogID; // show dialog box
}

/**
 * Audio Preview
 * First click = play, second click = pause.
 */

function audioPreview(element, type) {
  var audio = document.querySelector('#sound-selection audio');
  var source = audio.src;
  var playing = !audio.paused;

  // Both ringer and notification are using notification channel
  audio.mozAudioChannelType = 'notification';

  var url = '/shared/resources/media/' + type + '/' +
            element.querySelector('input').value;
  audio.src = url;
  if (source === audio.src && playing) {
    audio.pause();
    audio.src = '';
  } else {
    audio.play();
  }
}

/**
 * JSON loader
 */

function loadJSON(href, callback) {
  if (!callback)
    return;
  var xhr = new XMLHttpRequest();
  xhr.onerror = function() {
    console.error('Failed to fetch file: ' + href, xhr.statusText);
  };
  xhr.onload = function() {
    callback(xhr.response);
  };
  xhr.open('GET', href, true); // async
  xhr.responseType = 'json';
  xhr.send();
}

/**
 * L10n helper
 */

function localize(element, id, args) {
  var mozL10n = navigator.mozL10n;
  if (!element || !mozL10n)
    return;

  if (id) {
    element.dataset.l10nId = id;
  } else {
    element.dataset.l10nId = '';
    element.textContent = '';
  }

  if (args) {
    element.dataset.l10nArgs = JSON.stringify(args);
  } else {
    element.dataset.l10nArgs = '';
  }

  mozL10n.ready(function l10nReady() {
    mozL10n.translate(element);
  });
}

/**
 * Helper class for formatting file size strings
 * required by *_storage.js
 */

var FileSizeFormatter = (function FileSizeFormatter(fixed) {
  function getReadableFileSize(size, digits) { // in: size in Bytes
    if (size === undefined)
      return {};

    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = 0;
    while (size >= 1024) {
      size /= 1024;
      ++i;
    }

    var sizeString = size.toFixed(digits || 0);
    var sizeDecimal = parseFloat(sizeString);

    return {
      size: sizeDecimal.toString(),
      unit: units[i]
    };
  }

  return { getReadableFileSize: getReadableFileSize };
})();

/**
 * Helper class for getting available/used storage
 * required by *_storage.js
 */

var DeviceStorageHelper = (function DeviceStorageHelper() {
  function getStat(type, callback) {
    var deviceStorage = navigator.getDeviceStorage(type);

    if (!deviceStorage) {
      console.error('Cannot get DeviceStorage for: ' + type);
      return;
    }
    deviceStorage.freeSpace().onsuccess = function(e) {
      var freeSpace = e.target.result;
      deviceStorage.usedSpace().onsuccess = function(e) {
        var usedSpace = e.target.result;
        callback(usedSpace, freeSpace, type);
      };
    };
  }

  function getFreeSpace(callback) {
    var deviceStorage = navigator.getDeviceStorage('sdcard');

    if (!deviceStorage) {
      console.error('Cannot get free space size in sdcard');
      return;
    }
    deviceStorage.freeSpace().onsuccess = function(e) {
      var freeSpace = e.target.result;
      callback(freeSpace);
    };
  }

  function showFormatedSize(element, l10nId, size) {
    if (size === undefined || isNaN(size)) {
      element.textContent = '';
      return;
    }

    // KB - 3 KB (nearest ones), MB, GB - 1.2 MB (nearest tenth)
    var fixedDigits = (size < 1024 * 1024) ? 0 : 1;
    var sizeInfo = FileSizeFormatter.getReadableFileSize(size, fixedDigits);

    var _ = navigator.mozL10n.get;
    element.textContent = _(l10nId, {
      size: sizeInfo.size,
      unit: _('byteUnit-' + sizeInfo.unit)
    });
  }

  return {
    getStat: getStat,
    getFreeSpace: getFreeSpace,
    showFormatedSize: showFormatedSize
  };
})();

/**
 * This emulates <input type="range"> elements on Gecko until they get
 * supported natively.  To be removed when bug 344618 lands.
 * https://bugzilla.mozilla.org/show_bug.cgi?id=344618
 */

function bug344618_polyfill() {
  var range = document.createElement('input');
  range.type = 'range';
  if (range.type == 'range') {
    // In some future version of gaia that will only be used with gecko v23+,
    // we can remove the bug344618_polyfill stuff.
    console.warn("bug344618 has landed, there's some dead code to remove.");
    var sel = 'label:not(.without_bug344618_polyfill) > input[type="range"]';
    var ranges = document.querySelectorAll(sel);
    for (var i = 0; i < ranges.length; i++) {
      var label = ranges[i].parentNode;
      label.classList.add('without_bug344618_polyfill');
    }
    return; // <input type="range"> is already supported, early way out.
  }

  /**
   * The JS polyfill transforms this:
   *
   *   <label>
   *     <input type="range" value="60" />
   *   </label>
   *
   * into this:
   *
   *   <label class="bug344618_polyfill">
   *     <div>
   *       <span style="width: 60%"></span>
   *       <span style="left: 60%"></span>
   *     </div>
   *     <input type="range" value="60" />
   *   </label>
   *
   * JavaScript-wise, two main differences between this polyfill and the
   * standard implementation:
   *   - the `.type' property equals `text' instead of `range';
   *   - the value is a string, not a float.
   */

  var polyfill = function(input) {
    input.dataset.type = 'range';

    var slider = document.createElement('div');
    var thumb = document.createElement('span');
    var fill = document.createElement('span');
    var label = input.parentNode;
    slider.appendChild(fill);
    slider.appendChild(thumb);
    label.insertBefore(slider, input);
    label.classList.add('bug344618_polyfill');

    var min = parseFloat(input.min);
    var max = parseFloat(input.max);

    // move the throbber to the proper position, according to input.value
    var refresh = function refresh() {
      var pos = (input.value - min) / (max - min);
      pos = Math.max(pos, 0);
      pos = Math.min(pos, 1);
      fill.style.width = (100 * pos) + '%';
      thumb.style.left = (100 * pos) + '%';
    };

    // move the throbber to the proper position, according to mouse events
    var updatePosition = function updatePosition(event) {
      var pointer = event.changedTouches && event.changedTouches[0] ?
                    event.changedTouches[0] :
                    event;
      var rect = slider.getBoundingClientRect();
      var pos = (pointer.clientX - rect.left) / rect.width;
      pos = Math.max(pos, 0);
      pos = Math.min(pos, 1);
      fill.style.width = (100 * pos) + '%';
      thumb.style.left = (100 * pos) + '%';
      input.value = min + pos * (max - min);
    };

    // send a 'change' event
    var notify = function notify() {
      var evtObject = document.createEvent('Event');
      evtObject.initEvent('change', true, false);
      input.dispatchEvent(evtObject);
    };

    // user interaction support
    var isDragging = false;
    var onDragStart = function onDragStart(event) {
      updatePosition(event);
      isDragging = true;
    };
    var onDragMove = function onDragMove(event) {
      if (isDragging) {
        updatePosition(event);
        // preventDefault prevents vertical scrolling
        event.preventDefault();
      }
    };
    var onDragStop = function onDragStop(event) {
      if (isDragging) {
        updatePosition(event);
        notify();
      }
      isDragging = false;
    };
    var onClick = function onClick(event) {
      updatePosition(event);
      notify();
    };

    slider.addEventListener('mousedown', onClick);
    slider.addEventListener('touchstart', onClick);
    thumb.addEventListener('mousedown', onDragStart);
    thumb.addEventListener('touchstart', onDragStart);
    label.addEventListener('mousemove', onDragMove);
    label.addEventListener('touchmove', onDragMove);
    label.addEventListener('mouseup', onDragStop);
    label.addEventListener('touchend', onDragStop);
    label.addEventListener('touchcancel', onDragStop);

    // expose the 'refresh' method on <input>
    // XXX remember to call it after setting input.value manually...
    input.refresh = refresh;
  };

  // apply to all input[type="range"] elements
  var selector = 'label:not(.bug344618_polyfill) > input[type="range"]';
  var ranges = document.querySelectorAll(selector);
  for (var i = 0; i < ranges.length; i++) {
    polyfill(ranges[i]);
  }
}

/**
 * Connectivity accessors
 */

// create a fake mozMobileConnection if required (e.g. desktop browser)
var getMobileConnection = function() {
  var navigator = window.navigator;
  if (('mozMobileConnection' in navigator) &&
      navigator.mozMobileConnection &&
      navigator.mozMobileConnection.data)
    return navigator.mozMobileConnection;

  var initialized = false;
  var fakeICCInfo = { shortName: 'Fake Free-Mobile', mcc: '208', mnc: '15' };
  var fakeNetwork = { shortName: 'Fake Orange F', mcc: '208', mnc: '1' };
  var fakeVoice = {
    state: 'notSearching',
    roaming: true,
    connected: true,
    emergencyCallsOnly: false
  };

  function fakeEventListener(type, callback, bubble) {
    if (initialized)
      return;

    // simulates a connection to a data network;
    setTimeout(function fakeCallback() {
      initialized = true;
      callback();
    }, 5000);
  }

  return {
    addEventListener: fakeEventListener,
    iccInfo: fakeICCInfo,
    get data() {
      return initialized ? { network: fakeNetwork } : null;
    },
    get voice() {
      return initialized ? fakeVoice : null;
    }
  };
};

var getBluetooth = function() {
  var navigator = window.navigator;
  if ('mozBluetooth' in navigator)
    return navigator.mozBluetooth;
  return {
    enabled: false,
    addEventListener: function(type, callback, bubble) {},
    onenabled: function(event) {},
    onadapteradded: function(event) {},
    ondisabled: function(event) {},
    getDefaultAdapter: function() {}
  };
};

// Need to be renamed
var Accessor = {
  sync: function(key, cb){
    navigator.mozSettings.addObserver(key, function(event) {
      cb(event.settingValue);
    });
  },
  set: function(keys, cb) {
    var request = navigator.mozSettings.createLock().set(keys);
    request.onsuccess = cb;
    request.onerror = function errorGetCurrentSound() {
      debug('Error set', keys);
    };
  },
  get: function(key, cb) {
    var request = navigator.mozSettings.createLock().get(key);
    request.onsuccess = function() {
      if (request.result[key] != undefined) {
        cb(request.result[key]);
      }
    };
    request.onerror = function errorGetCurrentSound() {
      debug('Error get', key);
    };
  }
};

var initSettingsCheckbox = function() {
  // preset all checkboxes
  var rule = 'input[type="checkbox"]:not([data-ignore])';
  var checkboxes = document.querySelectorAll(rule);
  for (var i = 0; i < checkboxes.length; i++) {
    var key = checkboxes[i].name;
    (function(j) {
      Accessor.get(key, function(value) {
        checkboxes[j].checked = !!value;
      });
    })(i);
  }
}

var initSettingsRange = function() {
  // preset all range inputs
  rule = 'input[type="range"]:not([data-ignore])';
  var ranges = document.querySelectorAll(rule);
  for (i = 0; i < ranges.length; i++) {
    var key = ranges[i].name;
    (function(j) {
      Accessor.get(key, function(value) {
        ranges[j].value = parseFloat(value);
        if (ranges[j].refresh) {
          ranges[j].refresh(); // XXX to be removed when bug344618 lands
        }
      });
    })(i);
  }
}

var fakeSelector = function() {
  // use a <button> instead of the <select> element
  var Select = function(select) {
    var parent = select.parentElement;
    var button = select.previousElementSibling;
    // link the button with the select element
    var index = select.selectedIndex;
    if (index >= 0) {
      var selection = select.options[index];
      button.textContent = selection.textContent;
      button.dataset.l10nId = selection.dataset.l10nId;
    }
    if (parent.classList.contains('fake-select')) {
      select.addEventListener('change', function() {
        var newSelection = select.options[select.selectedIndex];
        button.textContent = newSelection.textContent;
        button.dataset.l10nId = newSelection.dataset.l10nId;
      });
    }
  };

  // preset all select
  var selects = document.querySelectorAll('select');
  for (var i = 0, count = selects.length; i < count; i++) {
    var select = selects[i];
    var key = select.name;
    Accessor.get(key, function(value) {
      var option = 'option[value="' + value + '"]';
      var selectOption = select.querySelector(option);
      if (selectOption) {
        selectOption.selected = true;
      }
      Select(select);
    });
  }
}

var Language = {

  selectEl: document.querySelector('select[name="language.current"]'),
  smallEl: document.getElementById('language-desc'),
  dateEl: document.getElementById('region-date'),
  timeEl: document.getElementById('region-time'),

  init: function() {
    // Fill select
    this.supported(this.fill.bind(this));
    // Update infos
    window.addEventListener('localized', this.update.bind(this));
  },

  update: function() {
    var d = new Date();
    var f = new navigator.mozL10n.DateTimeFormat();
    var _ = navigator.mozL10n.get;
    this.dateEl.textContent = f.localeFormat(d, _('longDateFormat'));
    this.timeEl.textContent = f.localeFormat(d, _('shortTimeFormat'));
  },

  // Use from index.html to update the small
  updateSmall: function() {
    this.supported(this.small.bind(this));
  },

  small: function(languages) {
    this.smallEl.textContent = languages[navigator.mozL10n.language.code];
  },

  fill: function(languages) {
    this.selectEl.innerHTML = '';
    for (var lang in languages) {
      var option = document.createElement('option');
      option.value = lang;
      // Right-to-Left (RTL) languages:
      // (http://www.w3.org/International/questions/qa-scripts)
      // Arabic, Hebrew, Farsi, Pashto, Urdu
      var rtlList = ['ar', 'he', 'fa', 'ps', 'ur'];
      // Use script direction control-characters to wrap the text labels
      // since markup (i.e. <bdo>) does not work inside <option> tags
      // http://www.w3.org/International/tutorials/bidi-xhtml/#nomarkup
      var lEmbedBegin =
          (rtlList.indexOf(lang) >= 0) ? '&#x202B;' : '&#x202A;';
      var lEmbedEnd = '&#x202C;';
      // The control-characters enforce the language-specific script
      // direction to correctly display the text label (Bug #851457)
      option.innerHTML = lEmbedBegin + languages[lang] + lEmbedEnd;
      option.selected = (lang == document.documentElement.lang);
      this.selectEl.appendChild(option);
    }
  },

  // old getSupportedLanguages
  supported: function(callback) {
    if (!callback)
      return;

    if (this._languages) {
      callback(this._languages);
    } else {
      var self = this;
      var LANGUAGES = '/shared/resources/languages.json';
      loadJSON(LANGUAGES, function loadLanguages(data) {
        if (data) {
          self._languages = data;
          callback(self._languages);
        }
      });
    }
  }

};

var Keyboard = {

  layoutEl: document.getElementById('keyboard-layouts'),
  languageEl: document.getElementById('language-keyboard'),
  label: document.querySelector('#language-keyboard a'),
  small: document.querySelector('#language-keyboard small'),

  init: function() {
    Keyboard.enable();
    window.addEventListener('localized', this.update.bind(this));
  },

  update: function() {
    var prev = this.layoutEl.querySelector('li[hidden]');
    if (prev) {
      prev.hidden = false;
    }
    this.updateLabelAndSmall();
  },

  updateLabelAndSmall: function() {
    this.supported(this.labelAndSmall.bind(this));
  },

  // update the enabled keyboards list with the language associated keyboard
  enable: function() {
    this.supported(function(keyboards) {
      var newKb = keyboards.layout[navigator.mozL10n.language.code];
      var settingNewKeyboard = {};
      var settingNewKeyboardLayout = {};
      settingNewKeyboard['keyboard.current'] = navigator.mozL10n.language.code;
      settingNewKeyboardLayout['keyboard.layouts.' + newKb] = true;

      var settings = navigator.mozSettings;
      try {
        var lock = settings.createLock();
        // Enable the language specific keyboard layout group
        lock.set(settingNewKeyboardLayout);
        // Activate the language associated keyboard, everything.me also uses
        // this setting to improve searches
        lock.set(settingNewKeyboard);
      } catch (ex) {
        console.warn('Exception in mozSettings.createLock():', ex);
      }
    })
  },

  labelAndSmall: function(keyboards) {
    // // Get pointers to the top list entry and its labels which are used to
    // // pin the language associated keyboard at the top of the keyboards list
    // var pinnedKbLabel = ;
    // var pinnedKbSubLabel = pinnedKb.querySelector('small');
    this.small.textContent = '';

    // Get the current language and its associate keyboard layout
    var currentLang = document.documentElement.lang;
    var langKeyboard = keyboards.layout[currentLang];

    var kbSelector = 'input[name="keyboard.layouts.' + langKeyboard + '"]';
    var kbListQuery = this.layoutEl.querySelector(kbSelector);

    if (kbListQuery) {
      // Remove the entry from the list since it will be pinned on top
      // of the Keyboard Layouts list
      var kbListEntry = kbListQuery.parentNode.parentNode;
      kbListEntry.hidden = true;

      var label = kbListEntry.querySelector('a');
      var small = kbListEntry.querySelector('small');
      this.label.dataset.l10nId = label.dataset.l10nId;
      this.label.textContent = label.textContent;
      if (small) {
        this.small.dataset.l10nId = sub.dataset.l10nId;
        this.small.textContent = small.textContent;
      }
    } else {
      // If the current language does not have an associated keyboard,
      // fallback to the default keyboard: 'en'
      // XXX update this if the list order in index.html changes
      var englishEntry = this.layoutEl.children[1];
      englishEntry.hidden = true;
      this.label.dataset.l10nId = 'english';
      this.small.textContent = '';
    }
  },

  supported: function(callback) {
    if (!callback)
      return;

    if (this._kbLayoutList) {
      callback(this._kbLayoutList);
    } else {
      var self = this;
      var KEYBOARDS = '/shared/resources/keyboard_layouts.json';
      loadJSON(KEYBOARDS, function loadKeyboardLayouts(data) {
        if (data) {
          self._kbLayoutList = data;
          callback(self._kbLayoutList);
        }
      });
    }
  }

};
