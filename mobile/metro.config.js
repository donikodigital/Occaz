// mobile/metro.config.js
const path = require('path');
// getSentryExpoConfig = getDefaultConfig d'Expo + les identifiants de débogage que Sentry utilise pour relire les erreurs d'une
// version de production (sans eux, la pile d'appels d'un plantage est illisible : code compressé).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

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