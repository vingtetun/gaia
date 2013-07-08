var startupFunction = function(){
  var newMsgButton = document.getElementById('icon-add');
  newMsgButton.addEventListener('click', function() {
    window.open('new-message.html');
  });
}