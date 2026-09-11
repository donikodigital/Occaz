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

## Lot 4 (livré) — Paiement (initiation), Notation, Profil

- **Un vrai trou opérationnel trouvé avant d'écrire le moindre écran** :
  j'ai vérifié les contrats exacts dans le code source du backend
  plutôt que de deviner de mémoire, et découvert qu'aucun
  `PaymentProvider` n'est pré-créé en base — `GET
  /payment-providers/active` renverrait une liste vide sur un
  déploiement neuf, rendant le paiement impossible tant qu'un admin n'en
  crée pas un via l'API. L'écran de paiement gère ce cas proprement
  (message clair, pas de plantage) mais le blocage réel reste côté
  configuration backend — signalé, pas contourné en silence.
- **Paiement** : sélection du moyen de paiement (`GET
  /payment-providers/active`) puis `POST /payments/initiate` —
  fonctionne dès l'appel puisque le seul adaptateur actif
  (`SimulatedPaymentProvider`, backend Lot 5) capture immédiatement ;
  aucune UI de redirection/instructions n'était donc nécessaire pour ce
  lot. Les boutons "Payer maintenant" posés en attente depuis les
  Lots 2 et 3 sont maintenant branchés pour de vrai.
- **Notation** : étoiles interactives réutisables (`RatingStars`),
  critères secondaires optionnels (ponctualité, courtoisie,
  communication, fiabilité, état du véhicule) en plus de la note
  globale. Le bouton "Noter" n'apparaît que lorsque le statut est
  réellement `COMPLETED` — j'avais d'abord aussi inclus `DELIVERED`
  pour les envois, corrigé après relecture de la validation stricte
  côté backend (`RatingsService.rateForShipment`), qui aurait rejeté
  l'appel.
- **Profil** : écran de modification (prénom/nom), connecté à l'onglet
  Profil du Lot 1.

## Lot 5 (livré) — Espace chauffeur : Trajets (création, gestion, OTP)

- **Contrats vérifiés dans le code source du backend avant d'écrire le
  moindre écran** (comme pour le Lot 4) plutôt que reconstruits de
  mémoire — DTOs de création de trajet/véhicule/profil chauffeur, routes
  OTP chauffeur. Toute la couche a été bâtie sur des faits, pas des
  suppositions sur un projet vieux de plusieurs lots.
- **Refactor des sélecteurs ville/adresse** en composants partagés
  (`CityPickerScreen`, `LocationPickerScreen`) réutilisables entre les
  Stacks Expo Router `(customer)` et `(driver)`, qui sont deux
  navigateurs isolés — évite de dupliquer l'écran, pas seulement la
  logique.
- **Complétion de profil chauffeur** (section 5) : contrairement au
  profil client, pays et ville sont obligatoires — un chauffeur opère
  depuis un point précis. Statut de vérification (`PENDING`/`VALIDATED`/
  `SUSPENDED`/`REJECTED`) affiché en bannière sur l'accueil, sans
  bloquer la création de trajets (le backend ne l'exige pas non plus).
- **Véhicules** : ajout avec type, gabarit, plaque.
- **Création de trajet** — le cœur de ce lot : véhicule, itinéraire
  (réutilise le sélecteur d'adresse du Lot 3), date (bandeau des 21
  prochains jours) et heure (sélection par créneaux plutôt qu'un
  picker natif, pour rester entièrement vérifiable par le compilateur),
  places, prix, devise, tolérance aux colis.
- **Cycle de vie complet du trajet**, un bouton contextuel à la fois
  selon le statut réel : publier → signaler l'arrivée → (prise en
  charge OTP) → démarrer → signaler l'arrivée à destination → (dépose
  OTP) → clôturer. Chaque réservation active affiche sa propre carte de
  validation OTP (demande de code, saisie à 6 chiffres, vérification),
  fidèle à la règle d'or backend : le code est toujours généré côté
  serveur et transmis au passager, jamais au chauffeur.
- **Un vrai bug de logique trouvé et corrigé après coup, pas par le
  compilateur** : la condition d'affichage du bouton "Clôturer le
  trajet" filtrait déjà la liste aux réservations `CONFIRMED` puis
  revérifiait qu'aucune ne l'était — un non-sens qui produisait
  accidentellement le bon résultat. Simplifié en une vérification de
  liste vide, plus lisible et moins fragile.

## Lot 6 (livré) — Espace chauffeur : Envois, Portefeuille et retraits

- **Envois disponibles** (`GET /shipments/available`, filtrable par
  ville de départ/arrivée) et **assignation à l'un de ses propres
  trajets publiés** — directement depuis l'écran de détail d'un envoi,
  la logique d'éligibilité (trajet `PUBLISHED` et acceptant les colis)
  filtrée côté client avant même l'appel serveur, qui reste la
  validation qui fait foi.
- **Cycle de vie complet de l'envoi côté chauffeur** : en route pour la
  récupération → code OTP de récupération → en transit → en route pour
  la livraison → code OTP de livraison — même schéma de composant que
  l'OTP des trajets du Lot 5, adapté à ce second flux.
- **Onglet "Mon activité" du chauffeur** reçoit le même sélecteur
  segmenté Trajets/Envois que côté client (Lot 3) — cohérence
  volontaire entre les deux espaces plutôt que deux patterns différents
  pour le même besoin.
- **Nouvel onglet "Portefeuille"** (4ᵉ onglet chauffeur) : solde
  disponible et en attente, historique des transactions (crédits en
  vert, débits en rouge, montant signé fidèle au grand livre immuable
  du backend), retraits récents avec statut.
- **Demande de retrait** (`POST /payouts`) : montant plafonné côté
  client au solde disponible avant même l'appel serveur, numéro Mobile
  Money pré-rempli depuis le profil chauffeur s'il existe déjà.

## Mise à jour transversale — Responsive mobile + desktop

Appliquée après le Lot 5, avant le Lot 6, à la demande explicite du
client plutôt que retardée jusqu'à la fin des 9 lots (ce qui aurait
demandé de tout reprendre plusieurs fois). Tout lot à venir en hérite
nativement.

- **Infrastructure** (`src/theme/breakpoints.ts`, `src/hooks/useResponsive.ts`) :
  seuils `tablet`/`desktop`/`wide`, largeurs de contenu par type d'écran
  (`form` 480px, `detail` 640px, `content` 860px, `wide` 1120px). Sur
  mobile natif (iOS/Android), la largeur ne dépasse jamais le seuil
  `tablet` — ce hook ne change donc rien au rendu existant sur téléphone,
  il n'active de comportement différent qu'en usage desktop/navigateur.
- **`ScreenContainer` réécrit** : centre son contenu à largeur maximale
  au-delà du seuil tablette, et gagne un prop `footer` pour les barres
  d'action fixes — élimine un cas particulier bancal du Lot 2 (l'écran
  de détail d'un trajet recomposait `SafeAreaView`+`ScrollView` à la
  main faute de ce support). Chaque écran existant a reçu la largeur
  adaptée à son contenu (formulaires courts en `form`, fiches et
  formulaires longs en `detail`, tableaux de bord en `content` par
  défaut).
- **`ResponsiveList`** : les listes à cartes (activité client, résultats
  de recherche, trajets chauffeur) passent d'une colonne (mobile) à 2-3
  colonnes (tablette/desktop) — un seul composant plutôt qu'un calcul de
  `numColumns` répété à chaque écran.
- **Navigation desktop** : `ResponsiveTabBar`, un seul composant qui
  rend soit la barre d'onglets classique en bas d'écran (mobile), soit
  une barre latérale fixe façon application de gestion (desktop) — même
  état de navigation, deux présentations. Branché dans les deux espaces
  (client en indigo, chauffeur en émeraude, pour les distinguer d'un
  coup d'œil).
- **Une découverte technique en cours de route, vérifiée dans le code
  source d'Expo Router plutôt que supposée** : `import { Tabs } from
  'expo-router'` est déprécié dans cette version (57) — migré vers
  `expo-router/tabs`, qui expose proprement le type `BottomTabBarProps`
  nécessaire à la barre de navigation personnalisée.
- **Un bug bloquant trouvé et corrigé, pas seulement esthétique** :
  `expo-secure-store` (stockage des jetons d'authentification depuis le
  Lot 1) n'a aucune implémentation fonctionnelle sur web — vérifié
  directement dans son code source, pas supposé. Sans correction,
  **toute l'authentification aurait échoué sur desktop**. Repli sur
  `localStorage` uniquement sur web (`Platform.OS === 'web'`), avec une
  note explicite sur le compromis de sécurité que ça représente
  (accessible à tout script de la page, donc à garder en tête si une
  surface d'attaque XSS existe côté web) — le stockage natif reste
  inchangé sur iOS/Android.
- **Dépendances manquantes ajoutées** pour que le web fonctionne du
  tout : `react-native-web`, `react-dom`, et `react-native-svg`
  (requis par les icônes Tabler, jusque-là présent seulement de façon
  transitive — déclaré explicitement pour ne pas dépendre d'une
  résolution accidentelle).

## Lots à venir

| Lot | Contenu |
|---|---|
| 7 | Messagerie et Notifications (les deux rôles) |
| 8 | Litiges (les deux rôles) |
| 9 | Back-office web (Next.js) — SuperAdmin / Support, projet séparé |

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner EXPO_PUBLIC_API_URL vers votre backend

npm run start           # démarre Expo — scanner le QR code avec Expo Go
                         # ou lancer un simulateur iOS/Android
npm run web              # même app dans le navigateur (desktop)
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
