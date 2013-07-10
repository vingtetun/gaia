var startupFunction = function() {
  
  Threads.currentId = parseInt(window.location.hash.substr(1), 10); 
  
  var threadId = Threads.currentId;
  var filter;

  if (threadId) {
    filter = new MozSmsFilter();
    filter.threadId = threadId;

    ThreadUI.renderMessages(filter);
    ThreadUI.updateHeaderData(function updateHeader() {
      MessageManager.slide('left');
    });
  }
};
