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

## Lot 7 (livré) — Messagerie et Notifications (les deux rôles)

- **Deux vraies limites du backend actuel, contournées côté design plutôt
  que corrigées** (le client a demandé de ne plus toucher au backend
  pour l'instant) :
  - `GET /conversations/mine` ne renvoie ni le nom du correspondant ni
    de compteur de non-lus — seulement les références booking/shipment.
    La liste reste donc volontairement sobre (type + date) ; le contexte
    riche (qui écrit quoi) n'apparaît qu'une fois dans le fil, où
    chaque message porte son expéditeur.
  - `Notification` ne persiste jamais le texte réellement envoyé (le
    corps est rendu à la volée côté backend puis jeté — seuls `type` et
    `payload` bruts restent). Les libellés affichés sont donc générés
    côté client à partir du `type` (`notificationLabels.ts`), même
    principe que les statuts de trajet/réservation/envoi ailleurs dans
    l'app.
- **Messagerie** : nouvel onglet "Messages" dans les deux espaces (4ᵉ
  onglet client, 5ᵉ onglet chauffeur), fil de discussion avec bulles
  alignées selon l'expéditeur, distinction visuelle des interventions du
  support (`isSupportIntervention`). Interrogation périodique (10s)
  plutôt que temps réel — le backend n'expose aucun canal websocket pour
  ça. Boutons "Contacter" ajoutés sur le détail d'une réservation/d'un
  envoi (client) et sur chaque réservation/l'envoi lui-même (chauffeur),
  conditionnés à l'existence d'un chauffeur assigné quand c'est pertinent
  (`getOrCreateForShipment` du backend l'exige).
- **Notifications** : icône cloche (déjà en place côté client depuis le
  Lot 2, ajoutée pour la première fois côté chauffeur) menant à une boîte
  de réception avec icône par type, distinction lu/non-lu, "tout marquer
  comme lu". Les notifications push réelles ne sont volontairement pas
  câblées dans ce lot — le fournisseur backend n'est lui-même qu'un
  simulateur qui journalise en console (Lot 8 backend), construire
  l'enregistrement de jeton push maintenant n'aurait rien à recevoir.

## Lot 8 (livré) — Litiges (les deux rôles)

**Dernier lot mobile — le back-office web (Lot 9) est le seul restant.**

- Contrats vérifiés dans le code source du backend avant d'écrire quoi
  que ce soit (comme tous les lots précédents). Une vraie erreur de
  typage évitée au passage : `POST /disputes/:id/messages` renvoie le
  `DisputeMessage` créé, pas le litige entier — un détail qui aurait
  cassé silencieusement l'invalidation du cache si copié depuis le
  pattern de la messagerie du Lot 7 sans vérifier.
- **Ouverture toujours contextuelle, jamais dans le vide** : le bouton
  "Signaler un problème" vit sur le détail d'une réservation ou d'un
  envoi (les deux côtés), jamais comme un flux autonome qui obligerait
  à re-choisir quoi que ce soit — le contexte est déjà là. Côté
  chauffeur, un trajet ayant plusieurs réservations, le lien est posé
  sur chaque réservation individuellement, pas sur le trajet entier.
- **Liste des litiges** volontairement en lecture seule (statut,
  priorité, date) — la création se fait ailleurs, comme décrit ci-dessus.
  Accessible depuis l'onglet Profil des deux espaces.
- **Fil de discussion** avec les mêmes bulles que la messagerie du
  Lot 7, plus une distinction visuelle des réponses de l'agent assigné.
  Résolution affichée en tête du fil quand elle existe (type, montant
  remboursé le cas échéant, notes).
- **Un vrai bug d'ordre des messages trouvé à la relecture, pas par le
  compilateur** : les messages étaient inversés (donc triés du plus
  récent au plus ancien) sans que la liste soit configurée en mode
  `inverted` — résultat, le message le plus récent se serait affiché
  en haut de l'écran plutôt qu'en bas. Corrigé en ajoutant la prop
  manquante plutôt qu'en annulant l'inversion, pour garder le
  comportement "dernier message visible sans avoir à faire défiler",
  cohérent avec la messagerie du Lot 7.

## Mise à jour transversale — Publication sur les stores

Dernier chantier du plan initial. `app.json` n'avait **jamais eu
d'icône du tout** jusqu'ici (`icon`, `adaptive-icon`, `splash` non
référencés) — aurait bloqué toute soumission.

- **Icônes générées** (`assets/images/`) : un repère de localisation
  simple et lisible à petite taille, sur fond indigo — cohérent avec la
  charte déjà posée pour le web-admin. `icon.png` (1024×1024),
  `adaptive-icon.png` (Android, contenu dans la zone sûre centrale pour
  survivre au masquage en cercle/squircle), `splash-icon.png`,
  `favicon.png` (web).
- **`app.json` complété** : icônes référencées, `ios.buildNumber` et
  `android.versionCode` ajoutés (obligatoires pour toute soumission),
  plugin `expo-splash-screen` enfin configuré — le code appelait déjà
  `SplashScreen.preventAutoHideAsync()`/`hideAsync()` sans qu'aucune
  image ne soit jamais réellement configurée.
- **`eas.json`** : profils `development` / `preview` / `production`.
- **`store-assets/`** : fiche store complète en français
  (`listing-fr.md`), brouillon de politique de confidentialité
  reflétant fidèlement les données réellement collectées par l'app
  (`privacy-policy-fr.md` — **pas un document juridique validé**, à
  faire relire), et une checklist de soumission couvrant les
  déclarations obligatoires des deux stores (`SUBMISSION_CHECKLIST.md`).
- **Ce qui reste hors de ce lot** : captures d'écran réelles (besoin de
  l'app buildée), comptes de test pour les équipes de revue, et
  remplacer les `[À COMPLÉTER]` du brouillon de politique de
  confidentialité après relecture juridique.

## Mise à jour transversale — Photo de profil chauffeur

- **`ProfilePhotoField`** (nouveau) : avatar rond, recadrage carré imposé
  à la sélection (`allowsEditing` + `aspect: [1,1]`) — contrairement aux
  documents d'identité, jamais recadrés.
- **`useDriverPhotoUpload`** (nouveau) : même flux en 3 étapes que
  `useDocumentUpload`, mais un contrat simplifié (une seule photo, pas de
  notion de "type") — hook dédié plutôt que de forcer la généralisation
  du hook documents.
- Intégré à l'inscription (juste à côté de la CNI et du permis, avec un
  rappel visuel "obligatoire avant validation" tant qu'aucune photo n'est
  envoyée) et à la modification de profil, pour la changer plus tard.

## Mise à jour transversale — Email optionnel à l'inscription

`complete-profile.tsx` (client et chauffeur) gagne un champ email
optionnel — validation basique côté client, backend gère le conflit
d'unicité proprement. Permet de recevoir aussi les notifications par
email (bienvenue, paiement confirmé, litige...), en plus du push —
voir le README backend, section "Notifications réelles".

## Mise à jour transversale — Suivi de position en direct (premier plan + arrière-plan)

- **Côté chauffeur** (`useTripPositionBroadcast`) : demande d'abord la
  permission "Utilisation de l'app" (obligatoire), puis tente la
  permission **"Toujours"** — demandée de façon contextuelle, seulement
  quand un trajet démarre réellement, jamais au premier lancement (ce
  qu'Apple exige pour ne pas rejeter l'app en revue).
  - **Accordée** → suivi en arrière-plan réel via
    `expo-task-manager` + `expo-location`
    (`src/tasks/tripLocationTask.ts`), continue même app fermée. Une
    notification persistante s'affiche côté Android tant que le suivi
    tourne — obligatoire dès qu'un service tourne en fond, pas un choix.
  - **Refusée** → repli automatique en premier plan uniquement (l'ancien
    comportement), plutôt que de bloquer le chauffeur qui refuse ce
    niveau d'accès.
  - La tâche de fond n'a accès à aucun état React — elle relit le
    trajet actif depuis `activeTripStorage` (AsyncStorage) à chaque
    déclenchement, pour fonctionner même après un redémarrage de l'app
    par le système suite à un événement de localisation.
  - Aucun risque côté données si le signal d'arrêt est manqué (app tuée
    brutalement, etc.) : le backend rejette déjà toute mise à jour de
    position sur un trajet qui n'est plus `IN_PROGRESS` (voir
    `TripsService.updatePosition`) — au pire, quelques appels perdus,
    jamais une position stockée à tort.
- **Côté client** (`useTripPosition` + `DriverPositionCard`) : inchangé,
  toujours du polling REST — voir plus bas.
- `app.json` : `isIosBackgroundLocationEnabled` /
  `isAndroidBackgroundLocationEnabled` activés sur le plugin
  `expo-location` (ajoute automatiquement `UIBackgroundModes: ["location"]`
  côté iOS et les permissions Android nécessaires,
  `ACCESS_BACKGROUND_LOCATION` + service de premier plan).
- **À prévoir avant soumission** : Apple demande une justification
  explicite de l'usage "Always" en revue App Store — reprendre le texte
  du plugin (déjà rédigé en français) et l'exemple d'usage réel
  (partage de position pendant un trajet actif) dans le formulaire de
  review (voir `store-assets/SUBMISSION_CHECKLIST.md`).

- **À prévoir avant soumission** : Apple demande une justification
  explicite de l'usage "Always" en revue App Store — reprendre le texte
  du plugin (déjà rédigé en français) et l'exemple d'usage réel
  (partage de position pendant un trajet actif) dans le formulaire de
  review (voir `store-assets/SUBMISSION_CHECKLIST.md`).
- **Erreurs de version corrigées en cours de route** (lots précédents) :
  `expo-image-picker` avait été installé en `17.0.11` puis `57.0.17` ;
  `expo-task-manager` installé directement à `57.0.17`, la version
  alignée avec ce SDK Expo 57.

## Mise à jour transversale — Géocodage réel

Remplace la saisie 100% manuelle des adresses (`LocationPickerScreen`
notait déjà explicitement cette limite) par une vraie recherche
d'adresse — Mapbox, via un proxy backend (jamais de clé exposée côté
client).

- **`useAddressSearch`** : debounce manuel (350ms), pas de nouvelle
  dépendance pour ça.
- **`LocationSearchField`** : champ de recherche + suggestions en
  ligne. Sélectionner un résultat crée directement la Location
  (`geocodeTrust: 'EXACT'`) et referme l'écran.
- La saisie manuelle (ville + texte libre, `geocodeTrust: 'MANUAL'`)
  reste disponible en repli explicite ("Adresse introuvable ?") — utile
  dans les zones rurales moins bien couvertes par les données
  cartographiques.
- **Un vrai bug pré-existant corrigé** : `GeocodeTrust` utilisait
  `'GPS' | 'APPROXIMATE'`, des valeurs qui n'existent pas côté backend
  (`EXACT | APPROX | MANUAL`) — resté invisible tant que seul
  `'MANUAL'` était utilisé en pratique.

## Mise à jour transversale — Envoi de documents (upload réel)

Complète l'infrastructure de stockage ajoutée côté backend
(`StorageService`, Cloudflare R2) — jusque-là aucune vraie pièce
justificative ne pouvait être envoyée.

- **`useDocumentUpload`** : hook générique en 3 étapes (demande d'URL
  signée → PUT direct vers R2 → confirmation auprès du backend), jamais
  de fichier qui transite par le serveur NestJS. Réutilisé pour les
  documents chauffeur et véhicule sans dupliquer la logique.
- **`DocumentUploadField`** : composant UI (galerie ou appareil photo,
  badge de statut, motif affiché si rejeté).
- **Chauffeur** : `complete-profile.tsx` gagne une seconde étape après
  la création du profil — CNI et permis de conduire, avant d'atteindre
  l'accueil.
- **Véhicule** : `vehicle-new.tsx` gagne la même seconde étape — carte
  grise et assurance, juste après la création du véhicule.
- `expo-image-picker` ajouté (galerie + appareil photo), avec ses
  chaînes de permission en français dans `app.json`. Micro
  explicitement désactivé (`microphonePermission: false`) — inutile
  pour de simples photos de documents.

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

## Lot à venir

| Lot | Contenu |
|---|---|
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
