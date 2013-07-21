PagesIntro = {
  element: document.getElementById('pages-intro'),
  
  show: function() {
    this.element.classList.add('active');
  },
  
  hide: function(){
    this.element.classList.remove('active');
  }
  
}