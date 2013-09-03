'use strict';

requireApp('system/js/grouped_navigation.js');
requireApp('system/test/unit/mock_history.js');

suite('system/GroupedNavigation', function() {
  var smsManifest;
  var smsHistory, smsNewHistory;
  var mozHistory, googleHistory;

  setup(function() {
    mozHistory = new MockHistory('http://mozilla.com', 'remote');
    GroupedNavigation.insertSheet(0, 'http://mozilla.com', mozHistory);
    // [mozilla.com]

    smsManifest = 'app://sms.gaiamobile.org/manifest.webapp';
    smsHistory = new MockHistory('app://sms.gaiamobile.org', 'certified');
    GroupedNavigation.insertSheet(0, smsManifest, smsHistory);
    // [mozilla.com]-[sms]

    googleHistory = new MockHistory('http://google.com', 'remote');
    GroupedNavigation.insertSheet(1, 'http://google.com', googleHistory);
    // [mozilla.com]-[sms]-[google.com]

    smsNewHistory = new MockHistory('app://sms.gaiamobile.org/new.html', 'certified');
    GroupedNavigation.insertSheet(2, smsManifest, smsNewHistory);
    // [mozilla.com]-[sms]-[sms/new message]-[google.com]
  });

  teardown(function() {
    // XXX ugly but efficient teardown
    GroupedNavigation._groups = [];
  });

  suite('> basic grouping', function() {
    test('should group app sheet together', function() {
      assert.equal(smsHistory, GroupedNavigation.getSheet(1));
      assert.equal(smsNewHistory, GroupedNavigation.getSheet(2));
    });

    test('should not group websites together', function() {
      assert.equal(mozHistory, GroupedNavigation.getSheet(0));
      assert.equal(googleHistory, GroupedNavigation.getSheet(3));
    });
  });

  suite('> app switching', function() {
    var twitterHistory;

    setup(function() {
      // [mozilla.com]-[sms]-[sms/new message]-[google.com]
      twitterHistory = new MockHistory('http://twitter.com', 'remote');
      GroupedNavigation.insertSheet(3, 'http://twitter.com', twitterHistory);
      // [mozilla.com]-[sms]-[sms/new message]-[google.com]-[twitter.com]
    });

    suite('when the app is already launched', function() {
      var flatIndex;

      suite('> requesting from the midle of the stack', function() {
        setup(function() {
          flatIndex = GroupedNavigation.requestApp(3, smsManifest);
          // [mozilla.com]-[google.com]-[sms]-[sms/new message]-[twitter.com]
        });

        test('should insert all the app sheets after the current group', function() {
          assert.equal(mozHistory, GroupedNavigation.getSheet(0));
          assert.equal(googleHistory, GroupedNavigation.getSheet(1));
          assert.equal(smsHistory, GroupedNavigation.getSheet(2));
          assert.equal(smsNewHistory, GroupedNavigation.getSheet(3));
          assert.equal(twitterHistory, GroupedNavigation.getSheet(4));
        });

        test('should return the flat index of the top of the app group',
        function() {
          assert.equal(3, flatIndex);
        });
      });

      suite('> requesting from the last sheet', function() {
        setup(function() {
          flatIndex = GroupedNavigation.requestApp(4, smsManifest);
          // [mozilla.com]-[google.com]-[twitter.com]-[sms]-[sms/new message]
        });

        test('should insert all the app sheets after the current group', function() {
          assert.equal(mozHistory, GroupedNavigation.getSheet(0));
          assert.equal(googleHistory, GroupedNavigation.getSheet(1));
          assert.equal(twitterHistory, GroupedNavigation.getSheet(2));
          assert.equal(smsHistory, GroupedNavigation.getSheet(3));
          assert.equal(smsNewHistory, GroupedNavigation.getSheet(4));
        });

        test('should return the flat index at the top of the app group',
        function() {
          assert.equal(4, flatIndex);
        });
      });
    })

    suite('when the app isn\'t launched', function() {
      test('should return -1', function() {
        var flatIndex = GroupedNavigation.requestApp('app://dialer.gaiamobile.org/manifest.webapp');
        assert.equal(-1, flatIndex);
      });
    });
  });

  suite('> opening a new web sheet', function() {
    var twitterHistory;
    var flatIndex;

    setup(function() {
      // [mozilla.com]-[sms]-[sms/new message]-[google.com]
      twitterHistory = new MockHistory('http://twitter.com', 'remote');
      flatIndex = GroupedNavigation.insertSheet(2, 'http://twitter.com', twitterHistory);
      // [mozilla.com]-[sms]-[sms/new message]-[twitter.com]-[google.com]
    });

    test('should insert  after the current group', function() {
      assert.equal(smsHistory, GroupedNavigation.getSheet(1));
      assert.equal(smsNewHistory, GroupedNavigation.getSheet(2));
      assert.equal(twitterHistory, GroupedNavigation.getSheet(3));
      assert.equal(googleHistory, GroupedNavigation.getSheet(4));
    });

    test('should return the flat index of the sheet', function() {
      assert.equal(3, flatIndex);
    });
  });

  suite('> pruning', function() {
    var twitterHistory;
    var attachHistory;
    var conversationHistory;

    setup(function() {
      // [mozilla.com]-[sms]-[sms/new message]-[google.com]
      twitterHistory = new MockHistory('http://twitter.com', 'remote');
      GroupedNavigation.insertSheet(3, 'http://twitter.com', twitterHistory);
      // [mozilla.com]-[sms]-[sms/new message]-[google.com]-[twitter.com]

      attachHistory = new MockHistory('app://sms.gaiamobile.org/attach.html', 'certified');
      GroupedNavigation.insertSheet(2, smsManifest, attachHistory);
      // [mozilla.com]-[sms]-[sms/new message]-[sms/attach]-[google.com]-[twitter.com]

      conversationHistory = new MockHistory('app://sms.gaiamobile.org/conversation.html', 'certified');
      GroupedNavigation.insertSheet(1, smsManifest, conversationHistory);
      // [mozilla.com]-[sms]-[sms/conversation]-[google.com]-[twitter.com]
    });

    test('should prune the forward history inside the app', function() {
      assert.equal(smsHistory, GroupedNavigation.getSheet(1));
      assert.equal(conversationHistory, GroupedNavigation.getSheet(2));
    });

    test('should not prune outside the app', function() {
      assert.equal(googleHistory, GroupedNavigation.getSheet(3));
      assert.equal(twitterHistory, GroupedNavigation.getSheet(4));
    });
  });

  suite('> removing sheets', function() {
    var newCurrent;

    suite('before the current position', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.removeSheet(1, 0);
        // [sms]-[sms/new message]-[google.com]
      });

      test('should give a updated current position', function() {
        assert.equal(0, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.equal(smsHistory, GroupedNavigation.getSheet(0));
      });
    });

    suite('after the current position', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.removeSheet(1, 3);
        // [mozilla.com]-[sms]-[sms/new message]
      });

      test('should leave the current position unchanged', function() {
        assert.equal(1, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.isUndefined(GroupedNavigation.getSheet(3));
      });
    });

    suite('removing the current sheet', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.removeSheet(2, 2);
        // [mozilla.com]-[sms]-[google.com]
      });

      test('should go back a sheet', function() {
        assert.equal(1, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.equal(googleHistory, GroupedNavigation.getSheet(2));
      });
    });
  });

  suite('> sheet eviction', function() {
    var newCurrent;

    suite('before the current position', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.evictSheet(1, mozHistory);
        // [sms]-[sms/new message]-[google.com]
      });

      test('should give a updated current position', function() {
        assert.equal(0, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.equal(smsHistory, GroupedNavigation.getSheet(0));
      });
    });

    suite('after the current position', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.evictSheet(1, googleHistory);
        // [mozilla.com]-[sms]-[sms/new message]
      });

      test('should leave the current position unchanged', function() {
        assert.equal(1, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.isUndefined(GroupedNavigation.getSheet(3));
      });
    });

    suite('removing the current sheet', function() {
      setup(function() {
        // [mozilla.com]-[sms]-[sms/new message]-[google.com]
        newCurrent = GroupedNavigation.evictSheet(2, smsNewHistory);
        // [mozilla.com]-[sms]-[google.com]
      });

      test('should go back a sheet', function() {
        assert.equal(1, newCurrent);
      });

      test('should remove the sheet', function() {
        assert.equal(googleHistory, GroupedNavigation.getSheet(2));
      });
    });
  });
});
