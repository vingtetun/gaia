
'use strict';

var CSSOptimizer = (function() {
  function debug(str) {
    dump("CSSOptimizer: " + str + "\n");
  }

  function report(useful, useless, maybe) {
    debug("useful: " + useful.length + "\t" +
          "useless: " + useless.length + "\t" +
          "maybe: " + maybe.length + "\n");

    try {
      debug("A startup css file can be: ");
      var urlhelper = document.createElement('a');
      useful.forEach(function useRuleForStartup(rule) {
        if ('cssText' in rule) {
          dump(rule.cssText + "\n");
          return;
        }

        var content = rule.content;

        // Since we are going to rewrite a file let's make sure to have the
        // right path for images if the css file is not directly into style.
        if (content.indexOf("url") != -1) {
          // ok there is a url somewhere inside this file. Let's make sure
          // resolve it correctly.
          urlhelper.href = rule.href;
          var pathname = urlhelper.pathname.split("/");
          pathname.pop();
          pathname = pathname.join("/");

          var matches = null;
          var regexp = /url\("?([a-z\/_-]+\.(?:png|gif|jpg|svg|jpeg))"?\)/ig;
          var data = content;
          while ((matches = regexp.exec(data)) != null) {
            var url = matches[1];
            if (url[0] != "/") { // is it a relative path?
              content = content.replace(url, pathname + "/" + url);
            }
          }
        }

        dump(rule.selector + "{" + content + "}\n");
      });
    } catch(e) {
      debug(e);
    } 
  }

  function run() {
    var useful = [], useless = [], maybe = [];
    var pseudoElements = [":before", ":after", ":first-letter", ":first-line",
                          "::before", "::after"];

    var stylesheets = document.styleSheets;
    for (var i = 0; i < stylesheets.length; i++) {
      var stylesheet = stylesheets[i];
      
      var href = stylesheet.href;
      debug(href);

      var rules = stylesheet.cssRules;
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (rule.type != CSSRule.STYLE_RULE) {
          // Not a style rule. This should be investigated to make sure this is
          // useful or not. For now let's consider this is useful...
          debug("Not a style rule: " + rule.cssText);
          useful.push({cssText: rule.cssText});
          continue;
        }

        var matches = rule.cssText.match(/(.+){(.+)}/);
        var content = matches[2].trim();
        var selectors = matches[1].trim().split(',');
        selectors.forEach(function checkSelector(selector) {
          var data = {href: href, selector: selector, content: content};

          // Let's check for some pseudo-classes that will be unlikely in
          // the startup path.
          var isPseudoClass = false;
          var pseudoClasses = [":active", ":hover", ":focus"];
          pseudoClasses.forEach(function checkIsPseudoClass(pseudo) {
            if (selector.indexOf(pseudo) == -1)
              return;
            isPseudoClass = true;

            // This is a pseudo rule and this is likely not useful in the
            // startup path, but who knows?
            maybe.push(data);
          });

          if (isPseudoClass) {
            return;
          }

          // Pseudo-element matching is hard. So let's just assume that if the
          // main rule match then it is ok.
          pseudoElements.forEach(function ignorePseudoElement(element) {
            selector = selector.replace(element, '');
          });


          // Now let's check if there is a rule that match in the document.
          try {
            if (document.querySelector(selector)) {
              useful.push(data);
            } else {
              useless.push(data);
            }
          } catch(e) {
            debug("Error: " + e);
          }
        });
      }
    }

    report(useful, useless, maybe);
  }

  return run;
})();

window.addEventListener("load", function() {
  setTimeout(CSSOptimizer, 3000);
});
