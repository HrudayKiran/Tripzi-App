const { auth } = require('../../firebase');

module.exports = function authShim() {
  return auth;
};
