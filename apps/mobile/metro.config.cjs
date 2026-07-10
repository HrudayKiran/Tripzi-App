const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// apps/mobile is 2 levels deep from the monorepo root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo so Metro is aware of changes
config.watchFolders = [workspaceRoot];

// Allow Metro to resolve modules from both the project and the root node_modules
// (npm workspaces hoists packages to the root)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Custom shims
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-keyboard-controller': path.resolve(projectRoot, 'src/shims/keyboard-controller'),
};

module.exports = config;
