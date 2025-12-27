const { db } = require('../../firebase');
const { runTransaction: runTransactionNative } = require('firebase/firestore');

module.exports = function firestoreShim() {
  // minimal wrapper to match usage of firestore() in the app
  return {
    collection: (name) => ({
      doc: (id) => {
        // return a DocumentReference using modular API
        const { doc } = require('firebase/firestore');
        return doc(db, name, id);
      },
    }),
    // runTransaction expects a callback receiving a transaction-like object
    runTransaction: async (cb) => {
      return runTransactionNative(db, async (transaction) => {
        const wrapped = {
          get: async (ref) => {
            const snap = await transaction.get(ref);
            return { exists: snap.exists(), data: () => snap.data() };
          },
          update: (ref, data) => transaction.update(ref, data),
        };
        return cb(wrapped);
      });
    },
  };
};
