// mobile/app.config.js
//
// app.config.js prend le dessus sur app.json et reçoit sa config déjà
// fusionnée dans `config` — on l'étend juste pour injecter :
//  - le plugin @rnmapbox/maps avec le token secret lu depuis l'environnement
//  - le plugin @sentry/react-native (org/projet lus depuis l'environnement)
// Aucun secret n'est commité en dur : tout est injecté par EAS
// (`eas secret:create` / variables d'environnement EAS).

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],
});