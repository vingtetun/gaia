'use strict';

var GroupedNavigation = {
  getAllGroups: function(){
    return this._groups.map(function(group){
      return group.url;
    });
  },
  
  getSheet: function(flatIndex) {
    var indexPath = this._indexPath(flatIndex);

    var group = this._groups[indexPath.groupIndex];
    if (!group) {
      return undefined;
    }

    return group.sheets[indexPath.sheetIndex];
  },

  insertSheet: function(current, url, history) {
    var gIndex = this._indexOfGroup(url);
    var groupFound = (gIndex != -1) ? this._groups[gIndex] : null;

    if (history.isApp && groupFound) {
      var sheetIndex = this._indexPath(current).sheetIndex;
      for (var i = (groupFound.sheets.length - 1); i > sheetIndex; i--) {
        groupFound.sheets.splice(i, 1);
      }
      groupFound.sheets.push(history);
      return this._flatIndex(gIndex, (groupFound.sheets.length - 1));
    }

    var nextIndex = this._nextGroupIndex(current);
    this._groups.splice(nextIndex, 0, {url: url, sheets: [history]});
    return this._flatIndex(nextIndex, 0);
  },

  removeSheet: function(current, sheetFlatIndex) {
    var flatIndex = (current >= sheetFlatIndex) ? (current - 1) : current;

    var indexPath = this._indexPath(sheetFlatIndex);
    var groupIndex = indexPath.groupIndex;
    var sheetIndex = indexPath.sheetIndex;

    this._groups[groupIndex].sheets.splice(sheetIndex, 1);
    if (!this._groups[groupIndex].sheets.length) {
      this._groups.splice(groupIndex, 1);
    }

    return flatIndex;
  },

  evictSheet: function(current, sheet) {
    var ip = this._indexPathOfSheet(sheet);
    return this.removeSheet(current,
                            this._flatIndex(ip.groupIndex, ip.sheetIndex));
  },

  removeGroup: function(url) {
    // XXX: implement
    console.log('removing group', url);
  },

  requestApp: function(current, manifestURL) {
    var gIndex = this._indexOfGroup(manifestURL);
    if (gIndex == -1) {
      return -1;
    }

    var nextIndex = this._nextGroupIndex(current, gIndex);

    var group = this._groups.splice(gIndex, 1)[0];
    this._groups.splice(nextIndex, 0, group);

    return this._flatIndex(nextIndex, (group.sheets.length - 1));
  },


  _groups: [],

  _indexOfGroup: function(url) {
    for (var i = 0; i < this._groups.length; i++) {
      var group = this._groups[i];
      if (group.url == url) {
        return i;
      }
    }
    return -1;
  },

  _nextGroupIndex: function(current, insertedGroupIndex) {
    var currentGroupIndex = this._indexPath(current).groupIndex;
    if (typeof(insertedGroupIndex) == 'undefined') {
      return currentGroupIndex + 1;
    }
    return currentGroupIndex + ((insertedGroupIndex < currentGroupIndex) ? 0 : 1);
  },

  _flatIndex: function(groupIndex, sheetIndex) {
    var index = 0;
    for (var i = 0; i < groupIndex; i++) {
      index += this._groups[i].sheets.length;
    }
    return (index + sheetIndex);
  },

  _indexPath: function(flatIndex) {
    var steps = 0;
    for (var groupIndex = 0; groupIndex < this._groups.length; groupIndex++) {
      var group = this._groups[groupIndex];
      if ((steps + group.sheets.length) < flatIndex) {
        steps+= group.sheets.length;
        continue;
      }
      for (var sheetIndex = 0; sheetIndex < group.sheets.length; sheetIndex++) {
        if (steps == flatIndex) {
          return {
            groupIndex: groupIndex,
            sheetIndex: sheetIndex,
          };
        }
        steps++;
      }
    }
    return {groupIndex: -1, sheetIndex: -1};
  },

  _indexPathOfSheet: function(sheet) {
    for (var groupIndex = 0; groupIndex < this._groups.length; groupIndex++) {
      var group = this._groups[groupIndex];
      for (var sheetIndex = 0; sheetIndex < group.sheets.length; sheetIndex++) {
        var s = group.sheets[sheetIndex];
        if (s == sheet) {
          return {
            groupIndex: groupIndex,
            sheetIndex: sheetIndex,
          };
        }
      }
    }
    return {groupIndex: -1, sheetIndex: -1};
  },

  _debug: function() {
    console.log(JSON.stringify(this._groups.map(function(g) {
      return g.sheets.map(function(s) {
        return s.location;
      });
    })));
  }
};
