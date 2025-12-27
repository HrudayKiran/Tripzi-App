const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const extraNodeModules = {
  '@react-native-firebase/auth': path.resolve(projectRoot, 'src/shims/auth'),
  '@react-native-firebase/firestore': path.resolve(projectRoot, 'src/shims/firestore'),
  '@react-native-firebase/storage': path.resolve(projectRoot, 'src/shims/storage'),
  '@react-native-firebase/messaging': path.resolve(projectRoot, 'src/shims/messaging'),
  '@react-native-firebase/app': path.resolve(projectRoot, 'src/shims/app'),
  'react-native-keyboard-controller': path.resolve(projectRoot, 'src/shims/keyboard-controller'),
};

module.exports = (() => {
  const config = getDefaultConfig(projectRoot);
  config.resolver = config.resolver || {};
  config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, extraNodeModules);
  return config;
})();
