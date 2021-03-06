(function() {
  'use strict';

  window.addEventListener('historychange', function onHistoryChange(evt) {
    var history = evt.detail.current;

    if (history.isApp) {
      return;
    }

    history.oncangoback = updateControlsDisplay;
    history.oncangoforward = updateControlsDisplay;
    history.onlocationchange = function locationChange() {
      Rocketbar.setLocation(this.location);
      updateControlsDisplay.call(this);
    };

    updateControlsDisplay.call(history);

    var backButton = history.wrapper.querySelector('button.back');
    backButton.onclick = history.goBack.bind(history)
    var forwardButton = history.wrapper.querySelector('button.forward');
    forwardButton.onclick = history.goForward.bind(history);
  });

  function updateControlsDisplay() {
    this.wrapper.classList[this.canGoBack ? 'add' : 'remove']('canGoBack');
    this.wrapper.classList[this.canGoForward ? 'add' : 'remove']('canGoForward');
  }
})();
