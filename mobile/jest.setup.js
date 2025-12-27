import 'jest-expo';
import '@testing-library/react-native/extend-expect';

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: {
    uid: 'test-user-id',
  },
}));

jest.mock('@react-native-firebase/firestore', () => () => ({
  collection: (collectionName) => ({
    doc: (docId) => ({
      get: async () => ({
        exists: true,
        data: () => ({
          likes: [],
        }),
      }),
      runTransaction: jest.fn(),
    }),
  }),
}));
