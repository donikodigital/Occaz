// mobile/app.config.js
//
// app.config.js prend le dessus sur app.json et reçoit sa config déjà
// fusionnée dans `config` — on l'étend juste pour injecter le plugin
// @rnmapbox/maps avec le token secret lu depuis l'environnement (jamais
// commité en dur, injecté par EAS via `eas secret:create`).

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
  ],
});