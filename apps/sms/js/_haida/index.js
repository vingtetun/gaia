window.addEventListener('load', function() {  
  var newMsgButton = document.getElementById('icon-add');
  newMsgButton.addEventListener('click', function(){
    console.log('ELO!');
    window.open('new-message.html');
  });
});