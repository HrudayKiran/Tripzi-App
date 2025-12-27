const { storage } = require('../../firebase');

module.exports = function storageShim() {
  return storage;
};
