// mobile/app.config.js
//
// app.config.js prend le dessus sur app.json et reçoit sa config déjà
// fusionnée dans `config` — on l'étend juste pour injecter :
//  - le plugin @rnmapbox/maps avec le token secret lu depuis l'environnement
//  - le plugin @sentry/react-native (org/projet lus depuis l'environnement)
// Aucun secret n'est commité en dur : tout est injecté par EAS
// (variables d'environnement EAS : `eas env:create`).
//
// Le champ `owner` et `extra.eas.projectId` sont volontairement absents :
//  - sans `owner`, le projet appartient au compte connecté (`eas whoami`)
//  - `eas init` ajoute `extra.eas.projectId` dans app.json au premier lancement

const REQUIRED_FOR_BUILD = [
  'RNMAPBOX_MAPS_DOWNLOAD_TOKEN', // token secret Mapbox (sk....) pour télécharger le SDK natif
];

const RECOMMENDED = ['SENTRY_ORG', 'SENTRY_PROJECT'];

// On n'avertit que pendant un vrai build/prebuild, pas à chaque `expo start`
const isBuildContext =
  process.env.EAS_BUILD === 'true' || process.env.EXPO_PREBUILD === '1';

if (isBuildContext) {
  for (const name of REQUIRED_FOR_BUILD) {
    if (!process.env[name]) {
      console.warn(
        `[app.config] Variable manquante : ${name}. Le build Android/iOS risque d'échouer. ` +
          `Ajoute-la avec : eas env:create --environment <preview|production> --name ${name}`,
      );
    }
  }
  for (const name of RECOMMENDED) {
    if (!process.env[name]) {
      console.warn(`[app.config] Variable Sentry non définie : ${name}`);
    }
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // L'URL publique prime si elle est fournie par EAS, sinon valeur d'app.json
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra?.apiUrl,
  },
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