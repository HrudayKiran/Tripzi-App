// lightweight shim for messaging to satisfy bundler and web runtime
const firebase = require('../../firebase');
const { getMessaging, getToken, onMessage } = require('firebase/messaging');

module.exports = function messagingShim() {
  const messagingInstance = (() => {
    try {
      return getMessaging();
    } catch (e) {
      return null;
    }
  })();

  return {
    AuthorizationStatus: {
      AUTHORIZED: 'authorized',
      PROVISIONAL: 'provisional',
    },
    requestPermission: async () => {
      // On web, permissions are handled differently; assume authorized for now
      return 'authorized';
    },
    getToken: async (opts) => {
      if (!messagingInstance) return '';
      try {
        return await getToken(messagingInstance, opts);
      } catch (e) {
        return '';
      }
    },
    onTokenRefresh: (cb) => {
      // token refresh not supported in this shim; no-op
      return () => {};
    },
    onMessage: (cb) => {
      if (!messagingInstance) return () => {};
      return onMessage(messagingInstance, cb);
    },
  };
};
