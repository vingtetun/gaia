PagesIntro = {
  element: document.getElementById('pages-intro'),
  
  resultListener: function(evt) {
    var url = evt.target.dataset.siteUrl;
    console.log(url);
    if (url) {
      this.hide();
      WindowManager.openNewSheet(url);
    }
  },
  
  showResults: function pagesIntro_showResults(results) {
    this.element.innerHTML = '';
    results.forEach(function(result) {
      if (result.uri !== 'about:blank') {
        var resultItem = document.createElement('li');
        var resultTitle = document.createElement('h3');
        var resultURL = document.createElement('small');
        resultTitle.textContent = result.title;
        resultURL.textContent = result.uri;
        resultItem.setAttribute('data-site-url', result.uri);
        resultItem.appendChild(resultTitle);
        resultItem.appendChild(resultURL);
        resultItem.addEventListener('click', this.resultListener.bind(this));
        this.element.appendChild(resultItem);
      }
    }, this);
  },
  
  init: function(){
    Places.getTopSites(6, '', this.showResults.bind(this));
  },
  
  show: function() {
    this.init();
    this.element.classList.add('active');
  },
  
  hide: function(){
    this.element.classList.remove('active');
  },
  
  isVisible: function(){
    return this.element.classList.contains('active');
  }
  
}