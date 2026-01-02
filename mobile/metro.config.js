const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const extraNodeModules = {
  'react-native-keyboard-controller': path.resolve(projectRoot, 'src/shims/keyboard-controller'),
};

module.exports = (() => {
  const config = getDefaultConfig(projectRoot);
  config.resolver = config.resolver || {};
  config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, extraNodeModules);
  return config;
})();
