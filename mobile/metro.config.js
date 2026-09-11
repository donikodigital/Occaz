// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

// getDefaultConfig lit tsconfig.json et résout automatiquement l'alias
// "@/*" défini dans compilerOptions.paths (support natif depuis les
// versions récentes d'Expo) — aucune configuration supplémentaire requise.
module.exports = getDefaultConfig(__dirname);
