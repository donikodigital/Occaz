// mobile/metro.config.js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// OCCAZ est un seul dépôt Git contenant backend/, mobile/ et web-admin/ —
// Metro/Expo peuvent détecter automatiquement la racine du monorepo (via
// le .git parent) et étendre watchFolders en conséquence, ce qui ferait
// surveiller aussi backend/node_modules et web-admin/node_modules (gros
// contributeur plausible à l'EMFILE "too many open files" sur Windows).
// On verrouille explicitement le scope à mobile/ pour éliminer cette
// variable, que l'auto-détection soit ou non la cause réelle.
config.watchFolders = [__dirname];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList].filter(Boolean)),
  new RegExp(`${path.resolve(__dirname, '..', 'backend').replace(/[\\]/g, '\\\\')}.*`),
  new RegExp(`${path.resolve(__dirname, '..', 'web-admin').replace(/[\\]/g, '\\\\')}.*`),
];

module.exports = config;