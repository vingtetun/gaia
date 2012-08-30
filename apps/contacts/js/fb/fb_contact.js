'use strict';

var fb = window.fb || {
  CATEGORY: 'facebook',
  NOT_LINKED: 'not_linked',
  LINKED: 'fb_linked'
};


// Encapsulates all the logic to obtain the data for a FB contact
fb.Contact = function(deviceContact, cid) {
  var contactData;
  var devContact = deviceContact;
  var contactid = cid;

  function doGetFacebookUid(data) {
    var ret = data.uid;
    if (!ret) {
      if (fb.isFbLinked(data)) {
        ret = getLinkedTo(data);
      } else if (data.category) {
        var idx = data.category.indexOf(fb.CATEGORY);
        if (idx !== -1) {
          ret = data.category[idx + 2];
        }
      }
    }
    return ret;
  }

  function getLinkedTo(c) {
    var ret;

    if (c.category) {
      var idx = c.category.indexOf(fb.LINKED);
      if (idx !== -1) {
        ret = c.category[idx + 1];
      }
    }

    return ret;
  }

  function getFacebookUid() {
    return doGetFacebookUid(deviceContact);
  }

  function setFacebookUid(value) {
    doSetFacebookUid(deviceContact, value);
  }

  function doSetFacebookUid(deviceContact, value) {
    if (!deviceContact.category) {
      deviceContact.category = [];
    }

    if (deviceContact.category.indexOf(fb.CATEGORY) === -1) {
      markAsFb(deviceContact);
    }

    var idx = deviceContact.category.indexOf(fb.CATEGORY);
    deviceContact.category[idx + 2] = value;
  }

  function markAsFb(deviceContact) {
    if (!deviceContact.category) {
      deviceContact.category = [];
    }

    if (deviceContact.category.indexOf(fb.CATEGORY) === -1) {
      deviceContact.category.push(fb.CATEGORY);
      deviceContact.category.push(fb.NOT_LINKED);
    }

    return deviceContact;
  }

  // Mark a mozContact (deviceContact) as linked to a FB contact (uid)
  function markAsLinked(deviceContact, uid) {
    if (!deviceContact.category) {
      deviceContact.category = [];
    }

    if (deviceContact.category.indexOf(fb.LINKED) === -1) {
      deviceContact.category.push(fb.CATEGORY);
      deviceContact.category.push(fb.LINKED);
      deviceContact.category.push(uid);
    }

    return deviceContact;
  }

  // The contact is now totally unlinked
  // [...,facebook, fb_not_linked, 123456,....]
  function markAsUnlinked(deviceContact) {
    var category = deviceContact.category;
    var updatedCategory = [];

    if (category) {
      var idx = category.indexOf(fb.CATEGORY);
      if (idx !== -1) {
        for (var c = 0; c < idx; c++) {
          updatedCategory.push(category[c]);
        }
        // The facebook category, the linked mark and the UID are skipped
        for (var c = idx + 3; c < category.length; c++) {
          updatedCategory.push(category[c]);
        }
      }
    }

    deviceContact.category = updatedCategory;

    return deviceContact;
  }

  // Sets the data for an imported FB Contact
  this.setData = function(data) {
    contactData = data;
  }

  Object.defineProperty(this, 'uid', {
    get: getFacebookUid,
    set: setFacebookUid,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(this, 'mozContact', {
    get: getDevContact
  });

  function getDevContact() {
    return devContact;
  }

  // For saving an imported FB contact
  this.save = function() {
    var outReq = new fb.utils.Request();
    if (!contactData || navigator.mozContacts) {
      throw 'Data or mozContacts not available';
      return;
    }

    window.setTimeout(function save_do() {
      var contactObj = new mozContact();
      // Info tbe saved on mozContacts
      var contactInfo = {};

      // Copying names to the mozContact
      copyNames(contactData, contactInfo);

      doSetFacebookUid(contactInfo, contactData.uid);

      contactObj.init(contactInfo);

      var mozContactsReq = navigator.mozContacts.save(contactObj);

      mozContactsReq.onsuccess = function(e) {
        // now saving the FB-originated data to the "private area"
        var data = Object.create(contactData.fbInfo);

        data.tel = contactData.tel || [];
        data.email = contactData.email || [];
        data.uid = contactData.uid;

        Object.keys(contactData.fbInfo).forEach(function(prop) {
          data[prop] = contactData.fbInfo[prop];
        });

        // Names are also stored on indexedDB
        // thus restoring the contact (if unlinked) will be trivial
        copyNames(contactData, data);

        var fbReq = fb.contacts.save(data);

        fbReq.onsuccess = function() {
          outReq.done(fbReq.result);
        }
        fbReq.onerror = function() {
          console.error('FB: Error while saving on indexedDB');
          outReq.failed(fbReq.error);
        }
      } // mozContactsReq.onsuccess

      mozContactsReq.onerror = function(e) {
        console.error('FB: Error while saving on mozContacts', e.target.error);
        outReq.failed(e.target.error);
      }
    },0);

    return outReq;
  }

  function copyNames(source, destination) {
    destination.name = source.name;
    destination.givenName = source.givenName;
    destination.familyName = source.familyName;
    destination.additionalName = source.additionalName;
  }

  // Merges mozContact data with Facebook data
  this.merge = function(fbdata) {
    if (!data) {
      return devContact;
    }


    var ret = Object.create(devContact);

    Object.keys(devContact).forEach(function(prop) {
      var value = devContact[prop];
      if (value && typeof value.forEach === 'function') {
        ret[prop] = [];
        ret[prop] = ret[prop].concat(value);
      } else if (value) {
        ret[prop] = value;
      }
    });

    mergeFbData(ret, fbdata);

    return ret;
  }

  function mergeFbData(deviceContact, fbdata) {
    var multipleFields = ['email', 'tel', 'photo', 'org'];

    multipleFields.forEach(function(field) {
      if (!deviceContact[field]) {
        deviceContact[field] = [];
      }

      var items = fbdata[field];
      if (items) {
        items.forEach(function(item) {
          deviceContact[field].push(item);
        });
      }
    });

    var singleFields = ['bday'];
    singleFields.forEach(function(field) {
      deviceContact[field] = fbdata[field];
    });

  }

  // Gets the data
  this.getData = function() {

    var outReq = new fb.utils.Request();

    window.setTimeout(function do_getData() {
      var uid = doGetFacebookUid(devContact);
      if (!uid) {
        outReq.done(devContact);
        return;
      }

      var fbReq = fb.contacts.get(uid);

      fbReq.onsuccess = function() {
        outReq.done(this.merge(fbReq.result));
      }.bind(this);

      fbReq.onerror = function() {
        outReq.failed(fbReq.error);
      }
    }.bind(this), 0);

    return outReq;
  }


  this.linkTo = function(fbFriend) {
    var ret = new fb.utils.Request();

    window.setTimeout(function do_linkTo() {
      if (devContact) {
        doLink(devContact, fbFriend, ret);
        return;
      }

      // We need to get the Contact data
      var req = fb.utils.getContactData(contactid);

      req.onsuccess = function() {
        devContact = req.result;
        doLink(devContact, fbFriend, ret);
      } // req.onsuccess

      req.onerror = function() {
        throw 'FB: Error while retrieving contact data';
      }
    },0);

    return ret;
  }

  function doLink(contactdata, fbFriend, ret) {
    if (!contactData) {
      throw 'FB: Contact data not defined';
    }

    if (fbFriend.uid) {
      markAsLinked(contactdata, fbFriend.uid);
    } else if (fbFriend.mozContact) {
      markAsLinked(contactdata, doGetFacebookUid(fbFriend.mozContact));
    }

    var mozContactsReq = navigator.mozContacts.save(contactdata);

    mozContactsReq.onsuccess = function(e) {
      var target = e.target;
      if (!fbFriend.mozContact) {
        ret.done(target.result);
        return;
      }

      // The FB contact on mozContacts needs to be removed
      var deleteReq = navigator.mozContacts.remove(fbFriend.mozContact);

      deleteReq.onsuccess = function(e) {
        ret.done(target.result);
      }

      deleteReq.onerror = function(e) {
        ret.failed(target.error);
        console.error('FB: Error while linking');
      }
    } // mozContactsReq.onsuccess

    mozContactsReq.onerror = function(e) {
      ret.failed(target.error);
    }
  }

  this.unlink = function() {
    var ret = new fb.utils.Request();

    window.setTimeout(function do_unlink() {
      if (devContact) {
        doUnlink(devContact, ret);
        return;
      }

      // We need to get the Contact data
      var req = fb.utils.getContactData(contactid);

      req.onsuccess = function() {
        devContact = req.result;
        doUnlink(devContact, ret);
      }

      req.onerror = function() {
        throw 'FB: Error while retrieving contact data';
      }
    }, 0);

    return ret;
  }

  function doUnlink(deviceContact, ret) {
    var uid = doGetFacebookUid(deviceContact);

    markAsUnlinked(deviceContact);
    var req = navigator.mozContacts.save(deviceContact);

    req.onsuccess = function(e) {
      // Then the original FB imported contact is restored
      var fbDataReq = fb.contacts.get(uid);

      fbDataReq.onsuccess = function() {
        var imported = fbDataReq.result;

        var data = {};
        copyNames(imported, data);
        doSetFacebookUid(data, uid);

        var mcontact = new mozContact();
        mcontact.init(data);

        // The FB contact is restored
        var reqRestore = navigator.mozContacts.save(mcontact);

        reqRestore.onsuccess = function(e) {
          ret.done(mcontact.id);
        }

        reqRestore.onerror = function(e) {
          ret.failed(e.target.error);
        }
      }

      fbDataReq.onerror = function() {
        window.console.error('FB: Error while unlinking contact data');
        ret.failed(fbDataReq.error);
      }
    }

    req.onerror = function(e) {
      ret.failed(e.target.error);
    }
  }

  this.remove = function() {
    // Removes the FB specific data from the device
    var ret = new fb.utils.Request();

    window.setTimeout(function do_remove() {
      var uid = doGetFacebookUid(devContact);

      var removeReq = navigator.mozContacts.remove(devContact);
      removeReq.onsuccess = function(e) {
        var fqReq = fb.contacts.remove(uid);
        fbReq.onsuccess = function() {
          ret.done(fbReq.result);
        }

        fbReq.onerror = function() {
          ret.failed(fbReq.error);
        }
      }

      removeReq.onerror = function(e) {
        ret.failed(e.target.error);
      }
    }, 0);

    return ret;
  }

}; // fb.Contact


fb.isFbContact = function(devContact) {
  return (devContact.category &&
                        devContact.category.indexOf(fb.CATEGORY) !== -1);
};


fb.isFbLinked = function(devContact) {
  return (devContact.category &&
                        devContact.category.indexOf(fb.LINKED) !== -1);
};
