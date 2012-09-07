/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

// Like console.log on top of dump()
function debug() {
  let s = '';
  for (var i = 0; i < arguments.length; i++)
    s += String(arguments[i]) + ' ';
  dump('***DEBUG: ' + s + '\n');
}

