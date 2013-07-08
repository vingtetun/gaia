
'use strict';


window.addEventListener('load', function start() {
  var open = document.getElementById('window.open');
  open.onclick = function() { window.open('foo.html'); }

  var openRemote = document.getElementById('window.open.remote');
  openRemote.onclick = function() { window.open('http://google.fr'); }

  var openAlert = document.getElementById('window.alert');
  openAlert.onclick = function() { window.alert('alert'); }

  var openPrompt = document.getElementById('window.prompt');
  openPrompt.onclick = function() { window.prompt('prompt'); }

  var openConfirm = document.getElementById('window.confirm');
  openConfirm.onclick = function() { window.confirm('confirm'); }
});
