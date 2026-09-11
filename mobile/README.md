<!-- mobile/README.md -->
# Mobile — Plateforme régionale de transport partagé

App React Native + Expo Router, construite pour consommer le backend
NestJS livré précédemment (voir `backend/README.md` pour l'API). Même
principe que le backend : livrée **par lots vérifiés** — chaque lot est
réellement compilé (`tsc --noEmit` strict) avant livraison.

Design validé avant implémentation (voir les trois maquettes de
l'onboarding, l'accueil et les résultats de recherche) : indigo pour la
marque, émeraude pour l'argent/la confiance, ambre pour l'énergie, fond
blanc cassé chaud — jamais de fond sombre. Typographie Inter.

## Lot 1 (livré) — Fondations, Design System, Authentification

- **Système de design** (`src/theme/`) : couleurs, typographie, espacements
  — un seul endroit pour tout ajuster, comme discuté avant l'implémentation.
- **Composants UI réutilisables** (`src/components/ui/`) : `AppText`,
  `Button`, `Card`, `Avatar`, `Badge`, `Divider`, `IconButton`, `TextField`,
  `ScreenContainer`. Tout écran futur se construit à partir de ces
  briques plutôt que de styles improvisés.
- **Client API typé** (`src/services/api/client.ts`) : décode l'enveloppe
  `{success, data}` du backend, ajoute le jeton d'accès automatiquement,
  et gère le rafraîchissement de session sur 401 — avec protection
  contre les rafraîchissements concurrents (une seule requête de
  rafraîchissement en vol, même si plusieurs appels échouent en même
  temps).
- **Stockage sécurisé des jetons** (`expo-secure-store`, jamais
  `AsyncStorage` pour un jeton).
- **Store d'authentification** (Zustand) avec hydratation au démarrage :
  au lancement, l'app vérifie qu'un jeton stocké est toujours valide via
  `GET /users/me` avant de considérer l'utilisateur connecté.
- **Flux d'authentification complet et fonctionnel**, fidèle aux
  maquettes validées : `onboarding` (choix client/chauffeur) →
  `login` (téléphone) → `verify-otp` (code à 6 cases, auto-remplissage
  SMS iOS via `textContentType="oneTimeCode"`, renvoi avec délai). Branché
  pour de vrai sur `POST /auth/otp/request` et `POST /auth/otp/verify`.
- Deux écrans de destination minimalistes (`(customer)/home`,
  `(driver)/home`) — juste assez pour prouver que le cycle complet
  (OTP → session → appel authentifié) fonctionne de bout en bout. Les
  vrais écrans d'accueil (recherche de trajet, envoi de colis, section 56
  du cahier des charges) arrivent au Lot 2.

## Lot 2 (livré) — Espace client : Accueil, recherche et réservation de trajets

- **Accueil réel**, fidèle à la maquette validée : salutation, recherches
  récentes persistées localement (`AsyncStorage` — non sensible, à
  distinguer du stockage sécurisé des jetons), tuiles "Trouver un trajet"
  / "Envoyer un colis" (la seconde affiche "bientôt disponible" tant que
  le Lot 3 n'est pas construit).
- **Un trou comblé au passage** : un compte client tout juste créé n'a
  pas encore de `CustomerProfile` côté backend (section 57). Ajout de
  l'écran `complete-profile` et du garde qui redirige automatiquement
  vers lui — sans ça, l'accueil serait resté bloqué pour tout nouvel
  utilisateur.
- **Parcours de recherche complet** : sélection de ville (modal avec
  recherche, connectée à `GET /cities`), bandeau de dates (14 prochains
  jours + "flexible"), nombre de passagers — jusqu'aux résultats
  (`GET /trips/search`), avec un filtre "chauffeurs vérifiés" réellement
  fonctionnel plutôt qu'un bouton qui ne fait rien.
- **Détail d'un trajet** : chauffeur, véhicule, itinéraire (avec étapes
  intermédiaires si présentes), prix — jusqu'à la **réservation**
  (`POST /bookings`), avec prise en charge des réservations de groupe
  (passagers nommés, section 9) et validation stricte côté client
  avant l'appel serveur.
- **Suivi des réservations** : détail avec statut, récapitulatif de prix
  (place × nombre, frais de service, total), annulation
  (`POST /bookings/:id/cancel`) ; onglet "Trajets" listant l'historique
  complet (`GET /bookings/mine`).
- Navigation par onglets (Accueil / Trajets / Profil) — l'onglet
  Messages n'est pas encore présent : mieux vaut trois onglets pleinement
  fonctionnels qu'un quatrième qui ne mène nulle part avant le Lot 7.
- Le paiement (`POST /payments/initiate`) n'est volontairement pas
  câblé ici — le bouton "Payer maintenant" sur une réservation en
  attente affiche "bientôt disponible", fidèle à la feuille de route
  (Lot 4).

## Lot 3 (livré) — Espace client : Envois de colis

- **Adresse hybride** (section 58) : sans intégration cartographique
  dans ce lot, l'adresse précise reste une ville + une description en
  texte libre (`POST /locations` avec `geocodeTrust: MANUAL`) —
  fidèle au repli prévu côté backend, pas une simplification qui
  trahirait le modèle.
- Refactor du sélecteur de ville (`citySelectionStore`) pour qu'il soit
  réutilisable par plusieurs écrans plutôt que dédié à la seule
  recherche de trajet : la sélection d'adresse d'envoi s'en sert aussi,
  via un nouveau `locationSelectionStore` pour faire remonter l'adresse
  créée jusqu'au formulaire.
- **Formulaire d'envoi complet** : expéditeur/destinataire (nom,
  téléphone, adresse), catégorie de colis (`GET
  /shipment-categories/usable`), poids, quantité, valeur déclarée,
  description, envoi urgent — avec validation avant l'appel serveur.
  Le prix exact n'est volontairement pas simulé côté client (aucun
  endpoint de devis n'existe côté backend) : affiché honnêtement comme
  "calculé à la validation".
- **Détail d'un envoi avec ligne de suivi visuelle** (timeline verticale
  à partir de `ShipmentTracking`), expéditeur/destinataire, récapitulatif
  de prix, annulation.
- **Onglet "Mon activité"** (anciennement "Trajets") : bascule
  Trajets/Envois par sélecteur segmenté plutôt qu'un quatrième onglet —
  un seul endroit pour tout l'historique du client, comme le pratiquent
  plusieurs applications de référence du secteur.
- Comme au Lot 2, "Payer maintenant" reste un bouton d'attente fidèle à
  la feuille de route (Lot 4). La sélection d'un trajet spécifique pour
  un envoi (plutôt que la recherche automatique de chauffeur) n'est pas
  couverte ici — signalé plutôt que construit à la hâte.

## Lots à venir

| Lot | Contenu |
|---|---|
| 4 | Paiement (initiation), Notation, Profil |
| 5 | Espace chauffeur — Trajets (création, gestion, OTP) |
| 6 | Espace chauffeur — Envois, Portefeuille et retraits |
| 7 | Messagerie et Notifications (les deux rôles) |
| 8 | Litiges (les deux rôles) |
| 9 | Back-office web (Next.js) — SuperAdmin / Support, projet séparé |

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner EXPO_PUBLIC_API_URL vers votre backend

npm run start           # démarre Expo — scanner le QR code avec Expo Go
                         # ou lancer un simulateur iOS/Android
```

Vérification avant toute modification : `npm run typecheck`.

## Notes d'architecture

- **Alias `@/*`** → `src/*` (voir `tsconfig.json` + `metro.config.js`,
  résolu nativement par Expo/Metro sans configuration Babel
  supplémentaire).
- **Un seul point d'accès réseau** : `src/services/api/client.ts`. Aucun
  écran n'appelle jamais `fetch` directement — toujours via un module
  `*.api.ts` dédié à une ressource (`auth.api.ts`, `users.api.ts`...),
  suivant le même principe que les contrôleurs du backend.
- **Argent** : tous les montants transitent en `Money` (= `string`,
  jamais `number`) — voir `src/services/api/types.ts` et
  `src/utils/money.ts`. Reflet direct du choix BigInt→string du backend.
- **État serveur vs état local** : TanStack Query pour tout ce qui vient
  de l'API (mis en cache, invalidable) ; Zustand uniquement pour l'état
  propre à l'app (session en cours). Un écran ne stocke jamais dans
  Zustand une donnée qui vient de l'API.
- **Dépendances tenues au minimum utilisé** : `zod` avait été retiré du
  Lot 1 faute d'usage réel ; `@react-native-async-storage/async-storage`
  a suivi le même chemin puis a été réintroduit dès qu'un besoin concret
  est apparu au Lot 2 (recherches récentes, donnée non sensible — à ne
  jamais confondre avec `expo-secure-store`, réservé aux jetons).
