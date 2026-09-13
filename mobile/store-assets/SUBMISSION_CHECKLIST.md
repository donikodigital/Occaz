<!-- mobile/store-assets/SUBMISSION_CHECKLIST.md -->
# Checklist de soumission — App Store & Google Play

## Comptes développeur (préalable, en dehors de ce dépôt)
- [ ] Compte Apple Developer (99 $/an) — https://developer.apple.com
- [ ] Compte Google Play Console (25 $, paiement unique) — https://play.google.com/console
- [ ] Compte Expo (gratuit) — nécessaire pour EAS Build/Submit

## Configuration technique (déjà faite dans ce lot)
- [x] Icônes générées (`assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`)
- [x] `app.json` : identifiants de bundle, version, icônes référencées
- [x] `eas.json` : profils development / preview / production
- [ ] Remplacer `extra.eas.projectId` et `owner` dans `app.json` (générés automatiquement au premier `eas build`, ou récupérables via `eas project:info`)

## Avant le premier build
```bash
npm install -g eas-cli
eas login
eas build:configure
```

## Construire et soumettre
```bash
# Interne, pour tester avant soumission
eas build --profile preview --platform all

# Version destinée aux stores
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

## Déclarations obligatoires — formulaires des consoles (pas des fichiers)

### App Store Connect — "App Privacy" (nutrition label)
D'après les données réellement collectées (voir `privacy-policy-fr.md`) :
- **Identifiants** : numéro de téléphone, email → liés à l'identité de l'utilisateur
- **Localisation** : position précise → liée à l'identité, utilisée pour la fonctionnalité de l'app (suivi de trajet), pas pour le suivi publicitaire
- **Informations financières** : historique de transactions → lié à l'identité
- **Contenu utilisateur** : photos de profil, documents d'identité, messages
- **Identifiants** : aucun identifiant publicitaire utilisé

### Google Play Console — "Data Safety"
Même déclaration en substance, formulaire différent — mêmes catégories
de données à cocher (localisation précise, informations personnelles,
informations financières, photos).

### Les deux stores
- [ ] URL de la politique de confidentialité (publier `privacy-policy-fr.md` sur une page web accessible avant de soumettre — obligatoire, pas optionnel)
- [ ] Justification de la demande de permission de localisation (déjà rédigée en français dans `app.json`, mais Apple demande parfois une explication supplémentaire dans le formulaire de review — reprendre le texte du plugin `expo-location`)
- [ ] Compte de test fourni aux équipes de revue (voir `listing-fr.md`, section "Notes pour la revue")

## Non couvert par ce lot, à prévoir séparément
- Captures d'écran réelles (nécessitent l'app buildée et des données de démonstration)
- Vidéo de présentation (optionnelle mais recommandée)
- Traduction de la fiche store dans d'autres langues si le marché cible s'étend au-delà du français
