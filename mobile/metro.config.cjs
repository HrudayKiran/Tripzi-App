const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;

const extraNodeModules = {
  'react-native-keyboard-controller': path.resolve(projectRoot, 'src/shims/keyboard-controller'),
};

const config = getDefaultConfig(projectRoot);
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, extraNodeModules);

module.exports = withNativeWind(config, { input: "./global.css" });
