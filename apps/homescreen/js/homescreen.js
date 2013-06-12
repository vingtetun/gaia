
'use strict';

const Homescreen = (function() {
  var mgmt = navigator.mozApps.mgmt;
  var grid = document.getElementById('icongrid');
  var page = document.getElementById('landing-page');
  var groupsPage = document.getElementById('groups-page');
  var iconList = document.getElementById('icon-list');
  var groupList = document.getElementById('group-list');
  var HVGA = document.documentElement.clientWidth < 480;
  var mainColor = {r:255, g:255, b:255};
  var iconsInGroup = 2+~~(Math.random()*3);
  var curIcons = 0;
  var currentGroup;
  var groupNames = [
    'Utils',
    'Apps',
    'Favorites',
    'Games',
    'System apps',
    'All your',
    'Base Are',
    'Belong to us'
  ];
  var gd = new GestureDetector(grid);
  gd.startDetecting();
  
  grid.addEventListener('transform', function(e) {
    var scale = e.detail.relative.scale;
    if (scale < 1) {
      page.classList.add('hide');
    } else if (scale > 1 ) {
      page.classList.remove('hide');
    }
  });
  
  var tileSize = 142;
  var tileClass = 'app-tile';
  var longTilesOffset = 0;
  //   ['<div class="app-tile">',
  //     '<label>APP NAME</label>',
  //     '</div>'];
      
  var updateCss = function updateCss() {
    var file = 'style/homescreen.css';
    var style = document.querySelector('link[href*="' + file + '"]');
    if (style) {
      style.href = '/' + file + '?reload=' + new Date().getTime();
    }
  }

  var createGroup = function() {
    iconsInGroup = 2+~~(Math.random()*3);
    currentGroup = document.createElement('li');
    currentGroup.innerHTML = groupNames.shift();
    groupList.appendChild(currentGroup);
    curIcons = 0;
  }
  
  createGroup();
  
  var els = ['menu', 'menutext'];
  for (var i=0; i < els.length; i++) {
    window.navigator.mozSettings.addObserver('gaia.ui.'+els[i], updateCss);
  };
      
  var req = mgmt.getAll();
  req.onsuccess = function(e) {
    var apps = req.result;
    //getPaintingColor(function(color) {
      //mainColor = color;
      for (var i=0, l=apps.length; i<l; i++) {
        renderIcon(apps[i]);
      }
    //});
    
    //setInterval(makeBlink, 3000);
  }
  
  function getIconURI(manifest) {
    var icons = manifest.icons;
    if (!icons) {
      return null;
    }

    var sizes = Object.keys(icons).map(function parse(str) {
      return parseInt(str, 10);
    });

    sizes.sort(function(x, y) { return y - x; });

    var index = sizes[(HVGA) ? sizes.length - 1 : 0];
    var iconPath = icons[index];

    return iconPath;
  }
  
  var renderIcon = function(app, entryPoint) {
    if (HIDDEN_APPS.indexOf(app.manifestURL) != -1 || HIDDEN_APPS.indexOf(entryPoint) != -1)
      return;
    
    if (app.manifest["entry_points"] && !entryPoint) {
      for (var entry in app.manifest["entry_points"]) {
        renderIcon(app, entry);
      }
      return;
    }
    
    var name, icon;
    if (entryPoint) {
      name = app.manifest.entry_points[entryPoint].name;
      icon = getIconURI(app.manifest.entry_points[entryPoint]);
    } else {
      name = app.manifest.name;
      icon = getIconURI(app.manifest);
    }
      
    // var tile = document.createElement('div');
    //     var label = document.createElement('label');
    var tile = document.createElement('li');
    var iconImage = new Image();
    var iconGroupImage = new Image();
    //var label = document.createElement('label');
    //tile.classList.add(tileClass);
    //label.textContent = name;
    
    if (icon) {
      icon = app.manifestURL.replace('/manifest.webapp', '') + icon;
    } else {
      icon = window.location.protocol + '//' +
              window.location.host + '/style/images/default.png';
    }
    iconImage.src = iconGroupImage.src = icon;
    //tile.style.backgroundImage = 'url(' + icon +')';
    //tile.classList.add('tr'+~~(Math.random()*3));
    
    //tile.style.listStyleImage = "url(" + icon + ")";
    tile.appendChild(iconImage);
    tile.innerHTML += name;
        
    if (curIcons < iconsInGroup) {
      curIcons++;
      currentGroup.appendChild(iconGroupImage);
    }
  
    //tile.appendChild(label);
    tile.addEventListener('click', (function(application, entry) {
      return function(){ 
        page.addEventListener('transitionend', function runAppTrans() {
          application.launch(entry ? entry : null);
          page.removeEventListener('transitionend', runAppTrans);
          setTimeout(function() {
            page.classList.remove('show');
          }, 500);
        });
        page.classList.add('show');
      }
    })(app, entryPoint));
    
    // if ((page.childNodes.length+longTilesOffset)%2===1) {
    //   if (~~(Math.random()*3) === 0) {
    //     longTilesOffset++;
    //     tile.classList.add('long-tile');
    //   }
    // }
    if ((iconList.children.length+1)%5 === 0) {
      tile.classList.add('end-of-section');
      createGroup();
    }
    iconList.appendChild(tile);
    if (curIcons === 1) {
      console.log('------- DODANO!');
      var scrollOffset = tile.getBoundingClientRect();
      currentGroup.dataset.scrollOffset = scrollOffset.top;
      currentGroup.addEventListener('click', function() {
        console.log('------- KLIKED!');
          page.scrollTop = this.dataset.scrollOffset;
          page.classList.remove('hide');
      });
    }
    
  }
  
  var makeBlink = function(){
    var randomChild = page.children[~~(Math.random()*page.children.length)];
    if (randomChild) {
      randomChild.addEventListener("animationend", function listener(){
        randomChild.classList.remove('animate');
        randomChild.removeEventListener("animationend", listener);
      });
      randomChild.classList.add('animate');
    }
  }
  
})();

