const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');
const sdkPackageNodeModules = path.resolve(workspaceRoot, 'packages/local-ai-sdk/node_modules');

const config = getDefaultConfig(projectRoot);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

config.watchFolders = [workspaceRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
config.resolver.resolverMainFields = ['react-native', 'browser', 'module', 'main'];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.blockList = exclusionList([new RegExp(`${escapeRegex(sdkPackageNodeModules)}\\/.*`)]);

module.exports = config;
