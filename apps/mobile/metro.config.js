const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@yourtime/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
  '@yourtime/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src'),
  '@': path.resolve(__dirname, 'src'),
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;