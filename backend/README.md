<!-- backend/README.md -->
# Backend — Plateforme régionale de transport partagé

Backend NestJS + Prisma + PostgreSQL, construit à partir du cahier des
charges optimisé et du `schema.prisma` (48 modèles). **Complet — les 9
lots ci-dessous couvrent l'intégralité du périmètre fonctionnel.**
Livré par lots vérifiés plutôt qu'en un seul bloc : chaque lot a été
réellement compilé (TypeScript strict) et revu avant packaging, pas
seulement rédigé.

## Lot 1 (livré) — Fondations, Authentification, RBAC, Géographie

- Infrastructure commune : guards (JWT + permissions), filtres d'exception
  (HTTP + Prisma), intercepteurs (réponse standardisée, logs), pagination,
  utilitaires argent (BigInt) et OTP.
- `PrismaService` avec middleware de soft delete automatique (Partie VII).
- `AuditService` générique, utilisé par tous les modules sensibles.
- Authentification complète : OTP par téléphone (Client/Chauffeur), mot de
  passe + 2FA TOTP (Support/SuperAdmin), refresh token avec rotation,
  révocation de session (une ou toutes), gestion des appareils.
- RBAC complet : rôles, permissions, attribution scoped par pays, seed des
  rôles par défaut (superadmin, support_agent, support_supervisor,
  finance_manager) repris du cahier des charges.
- Géographie : Pays / Devises / Régions / Préfectures / Villes.

## Lot 2 (livré) — Profils, Véhicules, Documents, Localisations

- `CustomerProfile` / `DriverProfile` : création à l'onboarding (`POST
  .../me`), lecture/mise à jour de son propre profil, listing et fiche
  admin paginés.
- Création d'un `DriverProfile` = création transactionnelle du `Wallet`
  associé (devise = devise par défaut du pays), conformément à la
  contrainte `@unique` du schéma — aucun chauffeur ne peut exister sans
  portefeuille.
- Workflow de vérification chauffeur (`verify` / `suspend` / `reactivate`,
  section 25) et compteurs de réputation (`completedTripsCount`,
  `cancellationCount`...) exposés pour incrémentation par les Lots 3/4.
- `Vehicle` : CRUD chauffeur (propriété vérifiée sur chaque écriture),
  workflow de vérification admin (`verify` / `reject`).
- `Document` : modèle polymorphique générique (section 43) — upload via
  les routes des modules propriétaires (`driver-profiles/me/documents`,
  `vehicles/:id/documents`), vue et actions admin centralisées
  (`/documents`), y compris `/documents/expiring-soon` (section 44).
- `Location` : modèle hybride GPS + texte libre (section 58). Écriture et
  lecture du point géographique PostGIS en SQL brut (`$executeRaw` /
  `$queryRaw`, le seul endroit du code qui en a besoin) et recherche de
  proximité `GET /locations/nearby` (`ST_DWithin`), qui met en œuvre la
  recommandation Partie III sur le rayon de recherche.

## Lot 3 (livré) — Trajets, Réservations, Recherche

- `Trip` : création (avec vérification de propriété du véhicule et de sa
  capacité), cycle DRAFT → PUBLISHED → CANCELLED. Les transitions
  DRIVER_ARRIVED → ... → COMPLETED sont repoussées au Lot 6 car elles
  exigent une validation OTP (règle d'or, section 18) — voir le
  commentaire en tête de `trips.service.ts` pour le détail de
  l'interprétation retenue sur le cycle de vie section 20.
- `TripStop` : ajout/suppression d'étapes intermédiaires tant que le
  trajet est en DRAFT.
- Recherche (`GET /trips/search`, section 8) en **deux modes** : par
  villes (rapide, indexé) ou par proximité géographique
  (`ST_DWithin` sur le point PostGIS d'origine, rayon lu depuis
  `PlatformSetting` avec repli par défaut) — implémente concrètement la
  recommandation Partie III plutôt que de rester une simple note.
- `Booking` + `TripPassenger` : réservation **atomique** (le décompte des
  places et la création de la réservation/des passagers se font dans une
  seule transaction avec condition sur `availableSeats`, pour empêcher un
  surbooking en cas de réservations simultanées). Prend en charge les
  réservations de groupe (passagers nommés).
- Nouveau module `PricingService`, partagé avec le futur module Envois :
  calcul de commission (section 39) et résolution de la politique
  d'annulation (section 26/63) directement depuis `CommissionRule` /
  `CancellationPolicy` — la gestion admin de ces tables arrive au Lot 5,
  mais le calcul, lui, est nécessaire dès qu'une réservation existe.
- Annulation d'un trajet par le chauffeur → cascade automatique sur ses
  réservations actives + incrément du compteur d'annulations chauffeur.
- L'exécution réelle des paiements/remboursements (webhook prestataire,
  écritures de portefeuille) est explicitement laissée au Lot 5 —
  `BookingsService.confirmPayment()` est prêt à être appelé par ce
  webhook, mais n'est volontairement exposé sur aucune route publique.

## Lot 4 (livré) — Envois, catégories, moteur tarifaire

- `ShipmentCategory` : CRUD admin (section 61 — autorisé/non autorisé,
  portée pays, `priceMultiplier` ajouté au schéma pour la tarification
  par catégorie citée section 40).
- `Shipment` : création avec **deux parcours**, comme décrit section 12 —
  soit le client choisit directement un trajet compatible (trouvé via
  `GET /trips/search?requiresShipmentCapacity=true`, déjà supporté
  depuis le Lot 3) et l'envoi passe en `DRIVER_ASSIGNED` immédiatement,
  soit aucun trajet n'est précisé et l'envoi passe en
  `SEARCHING_DRIVER` en attendant qu'un chauffeur l'accepte
  (`POST /shipments/:id/assign`, section 12 : ACCEPTER/REFUSER).
- Décompte de capacité (`availableShipmentWeightKg`) **atomique**, même
  principe que les places de `Booking` — transaction avec condition dans
  le `WHERE`, restauré à l'annulation.
- **Moteur tarifaire dédié** (`PricingService.computeShipmentPrice`,
  section 40 : prix de base + poids + distance réelle (PostGIS
  `ST_Distance` entre les deux `Location`) + multiplicateur de catégorie
  + majoration "urgent" — `isUrgent` ajouté au schéma. Tous les taux sont
  configurables via `PlatformSetting`, avec des valeurs par défaut
  documentées dans le code.
- `ShipmentTracking` alimenté automatiquement à chaque changement de
  statut (création, assignation, annulation) — historique disponible dès
  ce Lot, avant même le suivi GPS temps réel.
- Preuves photographiques (section 62) via le `Document` polymorphique du
  Lot 2 (`POST /shipments/:id/documents`), indépendantes de la validation
  OTP.
- Même principe que les Trajets pour le cycle de vie : les étapes
  PICKUP_PENDING → ... → COMPLETED, qui exigent une validation OTP, sont
  au Lot 6 — confirmé dans notre échange, avec le rappel que tout
  désaccord chauffeur/client passe par un `Dispute` (Lot 7), jamais une
  validation manuelle.

## Lot 5 (livré) — Paiement, Portefeuille/Ledger, Payout, Commission, Annulation

- **Architecture d'intégration par adaptateur** (section 14, fidèle au
  schéma `PaymentService -> OrangeMoneyProvider / MobileMoneyProvider /
  XOFProvider / FutureProvider`) : `PaymentProviderRegistry` résout un
  `PaymentProviderAdapter` selon le type configuré. Un seul adaptateur
  existe pour l'instant — `SimulatedPaymentProvider`, qui capture chaque
  paiement instantanément pour que tout le flux (confirmation de
  réservation, crédit du portefeuille) soit testable de bout en bout
  sans prestataire réel. **Ne jamais utiliser en production** — brancher
  un vrai adaptateur (Orange Money...) dans le registre avant tout
  lancement commercial, sans toucher au reste du système.
- `Payment` / `PaymentTransaction` : initiation (`POST
  /payments/initiate`), confirmation exclusivement par webhook
  (`POST /payments/webhooks/:providerType`, vérifié par l'adaptateur —
  jamais par l'app mobile, règle d'or section 13), idempotent si le
  webhook est rejoué.
- **`Shipment` corrigé pour vraiment attendre le paiement** : reste en
  `CREATED` jusqu'à confirmation, puis avance vers `DRIVER_ASSIGNED` ou
  `SEARCHING_DRIVER` — comblant l'écart que j'avais signalé à la
  livraison du Lot 4.
- **`WalletsService`** : hold/release sur `pendingBalance` — les fonds
  d'une prestation payée sont provisionnés (`holdBookingRevenue` /
  `holdShipmentRevenue`) mais ne rejoignent le solde disponible qu'à la
  validation OTP de fin de prestation (`releaseHeldFunds`, appelé par le
  Lot 6). Toute écriture passe par un verrou optimiste sur `version`
  (Partie VII) ; un conflit renvoie 409 plutôt que d'écraser une
  écriture concurrente.
- **Annulation → remboursement découplé par événements** :
  `BookingsService`/`ShipmentsService` émettent `BOOKING_CANCELLED` /
  `SHIPMENT_CANCELLED` (voir `common/events/domain-events.ts`) plutôt que
  d'appeler `PaymentsService` directement — ce qui aurait créé une
  dépendance circulaire de modules (Trips/Shipments → Payments →
  Trips/Shipments pour confirmer). `PaymentsService` écoute ces
  événements, exécute le remboursement via l'adaptateur et reverse les
  fonds tenus en attente (`reverseHeldFunds`).
- `PayoutsService` : demande de retrait (réserve `balance` →
  `pendingBalance`), traitement admin (`processing` / `paid` / `failed`
  avec restauration des fonds en cas d'échec) — toute écriture passe par
  les méthodes dédiées de `WalletsService`, jamais d'accès direct à
  `Wallet` ailleurs dans le code.
- CRUD admin `CommissionRule` et `CancellationPolicy` — les tables que
  `PricingService` lit depuis le Lot 3 sont maintenant gérables depuis
  le back-office.
- Remboursement manuel support (`POST
  /payments/bookings/:id/refund`) pour la résolution de litiges (Lot 7),
  distinct du remboursement automatique lié à une annulation.

## Lot 6 (livré) — OTP de prestation, Vérification, Notation

- **`OtpService`** générique (nouveau module `otp/`) pour les validations
  de prestation — distinct de l'OTP de connexion (`AuthService`, Lot 1)
  pour ne pas complexifier un flux déjà vérifié, mais réutilisant les
  mêmes utilitaires bas niveau.
- **Cycle de vie Trajet complété** (section 20) :
  `DRIVER_ARRIVED → PASSENGER_PICKED_UP → IN_PROGRESS → ARRIVED →
  COMPLETED`. Le code OTP est généré par réservation (pas par passager
  individuel — un groupe voyage et est pris en charge ensemble),
  transmis au client, jamais au chauffeur (règle d'or, section 18).
  `TripsService.completeTrip` exige que toutes les réservations actives
  soient déjà closes individuellement.
- **Cycle de vie Envoi complété** (`PICKUP_PENDING → PICKED_UP →
  IN_TRANSIT → DELIVERY_PENDING → DELIVERED → COMPLETED`) : OTP
  récupération envoyé à l'expéditeur, OTP livraison au destinataire — la
  livraison confirmée clôture directement l'envoi (un seul destinataire,
  pas besoin d'une action de clôture séparée comme pour un trajet à
  plusieurs réservations).
- **`WalletsService.releaseHeldFunds` et
  `DriverProfilesService.incrementCompletedTrips/Shipments` enfin
  appelés** — les fonds tenus en attente depuis le Lot 5 rejoignent le
  solde disponible du chauffeur exactement à la validation OTP de fin de
  prestation, jamais avant.
- `Verification` : suivi du processus de vérification documentaire
  (identité, permis, carte grise — PHONE reste couvert par
  `User.isPhoneVerified`, Lot 1, pas par ce workflow). Distinct du statut
  simple sur `Document` (Lot 2) : trace l'événement de revue lui-même
  (qui, quand, motif de rejet).
- `Rating`/`Review` : notation mutuelle après complétion (section 24),
  sens de la notation déduit de l'identité de l'appelant — jamais fourni
  par le client, pour empêcher une usurpation. Cache de note moyenne
  (`DriverProfile.averageRating`/`ratingsCount`, champs ajoutés au
  schéma) recalculé à chaque nouvelle note reçue d'un client.

## Lot 7 (livré) — Litiges

- `Dispute` : ouverture par le client OU le chauffeur, à n'importe quelle
  étape d'un trajet ou d'un envoi (pas seulement après complétion) —
  c'est précisément le point que tu avais soulevé : le recours en cas de
  désaccord passe par ici, jamais par une validation manuelle côté
  chauffeur.
- Décision de conception documentée dans le code : ouvrir un litige ne
  modifie **pas** le statut de la réservation/l'envoi (qui garde sa
  valeur, y compris `COMPLETED`) — seule la **résolution**, quand son
  type a une conséquence concrète, le modifie.
- `DisputeMessage` (accessible à l'ouvreur, au chauffeur/client concerné,
  à l'agent assigné, ou à tout agent support) et `DisputeEvidence`
  (réutilise le `Document` polymorphique du Lot 2).
- Triage : assignation à un agent (`DISPUTE_ASSIGN`), changement de
  statut (`OPENED → UNDER_REVIEW → WAITING_FOR_CUSTOMER/DRIVER →
  INVESTIGATION`), aligné sur les permissions posées au Lot 1 (l'agent
  clientèle peut consulter/échanger, seul le superviseur résout).
- **Chaque type de résolution déclenche sa vraie conséquence** plutôt que
  de rester une étiquette (section 22) : `FULL_REFUND`/`PARTIAL_REFUND`/
  `SHARED_RESPONSIBILITY` appellent réellement `PaymentsService`,
  `DRIVER_PAYOUT` libère les fonds tenus en attente si besoin,
  `CANCELLATION` annule et restaure la capacité du trajet,
  `SUSPENSION` appelle `UsersService.suspend` sur la partie visée.
- Un bug trouvé en cours de route et corrigé : le remboursement se
  déclenchait même quand le paiement n'était pas réellement capturé
  (`PaymentsService` l'ignore silencieusement dans ce cas) — la
  résolution du litige aurait enregistré un remboursement qui n'a
  jamais eu lieu. Désormais vérifié avant d'écrire la résolution.

## Lot 8 (livré) — Notifications, Conversations/Messages

- Deux nouvelles abstractions de canal, même principe que `SmsProvider`
  (Lot 1) et `PaymentProviderAdapter` (Lot 5) : `PushProvider` et
  `EmailProvider`, chacune avec une implémentation "console" pour le
  développement — **à remplacer avant toute mise en production**
  (Expo/Firebase pour le push, un service email transactionnel réel).
- `NotificationTemplatesService` : modèles par (type, canal, locale) avec
  rendu `{{placeholder}}` simple depuis le payload — configurables sans
  redéploiement (section 27).
- `NotificationsService` : point d'envoi unique — aucun autre module
  n'appelle un provider directement. Chaque envoi est tracé
  (`Notification.sentAt`/`failedReason`), même en cas d'échec du canal,
  et une boîte de réception (`GET /notifications/mine`) est exposée au
  client mobile.
- **Câblage réel dans les services existants** plutôt qu'une
  infrastructure qui resterait théorique : paiement confirmé, remboursement
  (push + SMS, "événement critique"), chauffeur trouvé pour un envoi,
  colis livré, fonds reçus par le chauffeur, nouveau message ou
  résolution de litige. D'autres points de déclenchement (départ
  imminent, arrivée...) s'ajoutent trivialement de la même façon —
  l'infrastructure ne demande plus de travail supplémentaire.
- `ConversationsModule` (section 23) : chat Client ↔ Chauffeur par
  réservation ou par envoi. L'intervention support est gouvernée par la
  permission `CONVERSATION_READ` (déjà posée au Lot 1) plutôt que par le
  type de compte brut — corrigé en cours de route pour rester cohérent
  avec le reste du RBAC de l'application.

## Lot 9 (livré) — Administration, tableaux de bord/KPI

**Dernier lot — les 48 modèles du schéma sont désormais couverts.**
Vérifié explicitement : un script recoupe chaque modèle du DMMF avec le
code source (y compris les écritures via `tx.` en transaction et les
écritures imbriquées via relation, invisibles à un simple `grep` naïf).

- `PlatformSettingsService` : administration de la table clé/valeur déjà
  lue depuis le Lot 3 (`trip.search_radius_km`) et le Lot 4 (tarifs
  d'envoi) — ce lot n'ajoute aucune nouvelle logique de lecture,
  seulement la gestion back-office.
- `TranslationsService` : CRUD sur la table de traduction générique
  (Partie VII), prête pour la Phase 2 langues (section 67) sans avoir
  attendu qu'elle soit nécessaire pour exister.
- `AuditLogsController` : le journal d'audit s'écrit depuis le Lot 1
  (`AuditService.log`, appelé par la quasi-totalité des lots) mais
  n'avait encore aucune surface de lecture — corrigé ici.
- **Quatre tableaux de bord (sections 45-48), chacun avec de vraies
  requêtes d'agrégation** — aucune valeur simulée :
  - **SuperAdmin** : utilisateurs/chauffeurs/clients, actifs sur 30
    jours, trajets/réservations/envois, litiges et taux de résolution,
    volume par pays (SQL brut, jointure trajet→ville→pays) et par
    devise, revenu de commission en série temporelle
    (`date_trunc`, seule façon propre d'obtenir un histogramme
    quotidien/hebdo/mensuel/annuel en SQL).
  - **Chauffeur** : prochain trajet, places réservées, envois à
    récupérer/en cours, solde portefeuille, note, statistiques.
  - **Client** : prochaine réservation, réservations/envois actifs,
    litiges ouverts, paiements récents. "Favoris" (section 47) est
    explicitement signalé comme non couvert plutôt que silencieusement
    omis : aucun modèle du schéma ne le porte, et il n'apparaît pas non
    plus dans le MVP du cahier des charges (Partie XIV) — l'ajouter
    aurait exigé une nouvelle table sans besoin confirmé.
  - **Support** : nouveaux litiges, litiges urgents (priorité
    HIGH/CRITICAL), litiges en attente, chauffeurs et clients "signalés"
    (comptage de litiges actifs par SQL brut).

## Le projet est maintenant complet — 9 lots, 48 modèles, 222 fichiers `.ts`

Chaque lot a été livré compilé (`tsc --noEmit` strict, zéro erreur) et
revu ligne par ligne avant packaging — pas seulement rédigé. Les
décisions d'interprétation prises sur les points ambigus du cahier des
charges (cycle de vie des statuts, portée des permissions, architecture
événementielle Trajets/Envois ↔ Paiement) sont documentées directement
dans le code, à l'endroit où elles s'appliquent.

Prochaines étapes naturelles, hors périmètre de ce backend :
- Remplacer `SimulatedPaymentProvider` par un vrai adaptateur
  (Orange Money...) avant tout lancement commercial.
- Remplacer les providers "console" (SMS/Push/Email) par de vrais
  services (Lot 1/8).
- Écrire les tests (unitaires, intégration, e2e — section 54 du cahier
  des charges) : volontairement hors périmètre de ces 9 lots, qui se
  sont concentrés sur la couverture fonctionnelle complète.
- Le frontend (mobile + back-office web).

- **Bug réel trouvé au premier déploiement Render, corrigé** : le
  moteur Prisma (variante musl, utilisée par les images Alpine) a
  besoin d'OpenSSL, absent par défaut de `node:22-alpine` — sans lui,
  échec au démarrage avec `Error loading shared library libssl.so`.
  Corrigé avec `RUN apk add --no-cache openssl` dans les étapes `deps`
  et `runner` du Dockerfile, et `binaryTargets` complété dans
  `schema.prisma` (`debian-openssl-3.0.x`, `linux-musl-openssl-3.0.x`,
  `linux-musl`) pour que Prisma génère le bon moteur pour cette
  plateforme. Jamais reproduit dans cet environnement de vérification
  (pas d'accès Docker ici) — trouvé et corrigé directement en
  production par Doniko.

## Déploiement (Docker, CI, health checks)

- **`Dockerfile`** : build en 4 étapes — dépendances + génération
  Prisma, compilation, dépendances de production seules, image finale
  avec utilisateur non-root. Le CLI `prisma` est une devDependency :
  l'étape de dépendances de production ne le réinstalle pas, elle
  récupère directement le client déjà généré à l'étape précédente.
  **Non testé par un vrai build Docker** dans cet environnement (pas
  d'accès à Docker Hub ici) — à vérifier une fois sur ta machine ou en
  CI, où le job `docker-build` le fait à chaque push.
- **`docker-compose.yml`** : pour tester l'image en local avant Render
  (`docker compose up --build`) — aucun service Postgres inclus, ce
  projet utilise Neon.
- **`/health`** (liveness, jamais de dépendance externe) et
  **`/health/ready`** (readiness, vérifie la base) — distinction
  standard pour un load balancer. Si Neon est en pause (scale-to-zero,
  voir plus haut), `/health` reste "ok" pendant que `/health/ready`
  passe à 503 le temps que la base se réveille, plutôt qu'un
  redémarrage en boucle inutile de l'instance.
- **CORS restreint** : `CORS_ALLOWED_ORIGINS` (liste séparée par des
  virgules) — vide en dev (tout autorisé), à renseigner en production
  avec les vrais domaines du mobile/web-admin.
- **CI** (`.github/workflows/ci.yml`) : à chaque push/PR touchant
  `backend/`, vérifie les types, compile, et construit l'image Docker.
  Aucun secret requis (Prisma génère son client à partir du seul
  schéma, sans connexion réelle à une base).

## Suivi de position (temps réel)

- **Nouveaux champs sur `Trip`** : `currentLatitude`, `currentLongitude`,
  `currentPositionUpdatedAt` — seule la dernière position est conservée
  (pas d'historique complet du trajet, hors scope MVP). **Nécessite une
  migration** (`npm run prisma:migrate`) avant de fonctionner.
- **Polling REST, pas de WebSocket** — `PATCH /trips/:id/position`
  (chauffeur, uniquement pendant `IN_PROGRESS`) et
  `GET /trips/:id/position` (le chauffeur du trajet, ou un client avec
  une réservation `PAID`/`CONFIRMED` dessus — jamais un tiers). Un choix
  d'architecture assumé : suffisant pour une fréquence de quelques
  secondes, beaucoup plus simple à opérer qu'un canal temps réel tant
  que le besoin de latence sub-seconde ne se fait pas sentir.
- **7 tests unitaires** sur `getPosition` — c'est la vérification
  d'autorisation la plus sensible de ce lot (qui peut voir la position
  d'un chauffeur), testée explicitement : propriétaire autorisé, autre
  chauffeur rejeté, client avec/sans réservation active, aucun
  identifiant fourni.
- Visibilité Support/SuperAdmin (utile pour l'instruction d'un litige)
  volontairement pas couverte — à ajouter via une permission dédiée si
  le besoin se confirme, pas un accès systématique.

## Géocodage

- **Mapbox** choisi pour son offre gratuite généreuse (100 000
  requêtes/mois) — voir `src/integrations/geocoding/` pour l'adapter,
  même principe que `SmsProvider` : remplaçable sans toucher au reste
  de l'app.
- `GET /geocoding/search?query=...&countryCode=gn` et
  `GET /geocoding/reverse?latitude=...&longitude=...` — toujours
  authentifiés, pour protéger le quota d'un usage comme proxy ouvert.
- Géocodage "temporaire" (comportement par défaut de l'API, jamais
  `permanent=true`) — conforme aux conditions d'utilisation Mapbox :
  seul le résultat choisi par l'utilisateur est persisté, via la route
  `POST /locations` déjà existante (le champ `geocodeTrust` du schéma
  l'anticipait déjà : `EXACT` pour un résultat géocodé, `MANUAL` pour
  la saisie libre).
- **Un vrai bug pré-existant trouvé en construisant ce lot** : le type
  `GeocodeTrust` côté mobile utilisait `'GPS' | 'APPROXIMATE'`, des
  valeurs qui n'existent pas dans l'enum réel du backend
  (`EXACT | APPROX | MANUAL`). Resté invisible jusqu'ici car seul
  `'MANUAL'` avait été utilisé en pratique — corrigé avant que
  l'intégration du géocodage ne le fasse échouer pour de vrai.

## Tests automatisés

**47 tests unitaires, réellement exécutés et vérifiés dans cet
environnement** (`npm test`) — pas une promesse, la commande a
effectivement tourné :
- `src/common/utils/otp.util.spec.ts` — hachage/vérification OTP (jamais le code en clair dans le hash, rejet strict).
- `src/common/utils/money.util.spec.ts` — conversion BigInt (rejette décimales/négatifs), formatage, sommes.
- `src/common/utils/duration.util.spec.ts` — parsing "15m"/"30d"/etc.
- `src/pricing/pricing.service.spec.ts` — `computeCommission` : pourcentage, montant fixe, plancher/plafond, priorité pays > global. La logique la plus directement liée à l'argent facturé.
- `src/trips/bookings.service.spec.ts` — pourcentage de remboursement selon le délai avant départ (avant/après/pile au seuil/départ déjà passé).
- `src/trips/trips.service.getPosition.spec.ts` — autorisation d'accès à la position d'un trajet (voir section "Suivi de position").

**Fondation e2e posée, non vérifiable dans cet environnement** —
honnêteté complète sur ce point précis : `test/health.e2e-spec.ts`
existe et suit un schéma standard NestJS/Supertest, mais tenter de le
lancer ici échoue dès le chargement des modules (`@nestjs/swagger` qui
inspecte un enum Prisma sur `create-vehicle.dto.ts`) — **pas** à cause
d'une base de données injoignable comme prévu, mais parce que
`@prisma/client` dans cet environnement est mon stub hors-ligne
(jamais eu d'accès réseau pour un vrai `prisma generate`, voir plus
haut dans ce README), qui ne fournit pas de vrais objets enum à cet
endroit précis. Un vrai client généré (ton environnement, une fois
`prisma generate` exécuté normalement) ne devrait pas rencontrer ce
problème. Il faudra malgré tout une base de test dédiée (ex: une
branche Neon séparée) pour que `/health/ready` et tout test e2e futur
touchant la base fonctionnent réellement — voir le commentaire en tête
du fichier.

```bash
npm test              # tests unitaires
npm run test:cov      # avec couverture
npm run test:e2e      # nécessite une DATABASE_URL joignable
```

## Corrections récentes (config + typage réel Prisma)

- **`tsconfig.build.json` créé** — n'avait jamais existé (projet
  construit fichier par fichier, pas via `nest new` qui le génère
  d'habitude). Sans lui, `nest start --watch`/`nest build` compilait
  aussi les fichiers `*.spec.ts` et `test/`, provoquant des centaines
  d'erreurs "Cannot find name describe/it/expect" sans rapport avec le
  code lui-même.
- **3 champs JSON mal typés, visibles seulement avec un vrai client
  Prisma généré** (jamais avec mon stub hors-ligne) : `config` et
  `diff` dans `payment-providers.service.ts`, `diff` dans
  `platform-settings.service.ts` — corrigés avec un cast explicite
  `as Prisma.InputJsonValue`.
- **`user-roles.service.ts`** : même limitation que celle déjà
  rencontrée dans `accounts.seed.ts` (upsert sur une clé composite
  incluant un `countryId` nullable, rejeté par le vrai client) —
  remplacé par le même contournement `findFirst` + `create`.

## Mode test (contournement OTP/2FA — réversible, jamais en vrai prod)

Demandé explicitement pour fluidifier les tests sur `occaz.sarl` en
attendant la fin des vérifications — volontairement **étroit** plutôt
qu'un contournement général :

- **Désactivé par défaut** (`AUTH_TEST_MODE_ENABLED` absent ou `false`)
  — aucun changement de comportement tant que non activé.
- **OTP** : pour les numéros listés dans `AUTH_TEST_PHONE_NUMBERS`
  (séparés par des virgules) uniquement, code fixe `000000`, aucun SMS
  envoyé (économise aussi le quota TextBee). Tout autre numéro suit le
  parcours normal.
- **2FA** : pour les emails listés dans `AUTH_TEST_STAFF_EMAILS`
  uniquement — la **configuration initiale** (`/auth/2fa/enable`)
  accepte le code fixe `000000` à la place d'un vrai code TOTP scanné,
  et la **vérification à la connexion** est ignorée une fois activée.
  Dans les deux cas, **le mot de passe reste obligatoire et vérifié
  normalement**, jamais contourné. Tout autre compte suit le parcours
  normal (vrai code d'authenticator exigé).
- Chaque contournement est journalisé (`[MODE TEST]`) — visible dans
  les logs Render si jamais laissé actif par erreur.
- **À retirer de l'environnement Render une fois les tests terminés** —
  ces trois variables n'ont aucune raison d'exister une fois de vrais
  utilisateurs sur la plateforme.

## SMS réel (TextBee)

- `TextBeeSmsProvider` — même principe d'initialisation différée que
  les autres fournisseurs (Storage, Mapbox, Resend) : démarre
  normalement sans `TEXTBEE_API_KEY`, échoue proprement à l'usage
  réel tant qu'elle est absente.
- Un seul appareil lié (offre gratuite) : pas besoin de préciser de
  `deviceId`, TextBee utilise l'appareil actif par défaut.
- Devenu le choix par défaut de `sms.module.ts` (comme Resend/Push) —
  remplace `ConsoleSmsProvider`.

## Mot de passe oublié (Support / SuperAdmin)

Manquait jusqu'ici — seul le repli par téléphone + OTP permettait de
recontourner un mot de passe/2FA perdu, sans readonner un vrai accès
par mot de passe.

- Réutilise l'infrastructure OTP existante (`OtpCode`, hachage, limite
  de tentatives) plutôt qu'un mécanisme séparé — nouvelle valeur
  d'enum `OtpPurpose.PASSWORD_RESET` (**migration nécessaire**).
- `POST /auth/password-reset/request` (email) → `POST
  /auth/password-reset/confirm` (email + code + nouveau mot de passe).
- **Ne révèle jamais si l'email existe** — même réponse générique dans
  tous les cas, seul un compte SUPPORT/SUPERADMIN valide reçoit
  réellement un code.
- Toutes les sessions actives sont révoquées après une réinitialisation
  réussie — traité comme un signal de compromission potentielle.
- Envoi par email (Resend) — voir la section notifications plus haut,
  fonctionne dès que `RESEND_API_KEY`/`RESEND_FROM_EMAIL` sont
  renseignées.

## Photo de profil chauffeur (obligatoire avant validation)

- `photoUrl` reste optionnel dans `CreateDriverProfileDto` (aucune photo
  ne peut exister avant l'upload), mais **`DriverProfilesService.verify()`
  refuse désormais de valider un chauffeur sans photo** — c'est le vrai
  point d'obligation, pas une contrainte de formulaire à la création.
- Même flux en 2 temps que les documents d'identité
  (`POST /driver-profiles/me/photo/upload-url` puis
  `POST /driver-profiles/me/photo`), mais une clé de stockage distincte
  (`driver-avatar/...` plutôt que `driver/...`) — une photo de profil est
  vue en permanence dans l'app (par les clients aussi, pas seulement le
  SuperAdmin), contrairement à une pièce d'identité.
- **Recommandé** : configurer un accès public en lecture sur ce seul
  préfixe dans le bucket R2 et renseigner `STORAGE_PUBLIC_BASE_URL` —
  sans ça, l'URL stockée est une URL signée qui expirera après quelques
  minutes, ce qui casserait l'affichage de l'avatar avec le temps.

## Notifications réelles (push + email)

Toute la plomberie de routage existait déjà (`NotificationsService` — un
seul point d'entrée `.notify()`, choix du modèle actif, traçabilité
`sentAt`/`failedReason`) ; seuls les fournisseurs `push` et `email`
étaient encore des simulations console. Les deux sont maintenant réels.

- **Push (Expo)** — `ExpoPushProvider`, gratuit, aucun compte à créer.
  Devenu le choix par défaut de `push.module.ts` immédiatement (rien à
  configurer). Filtre les tokens mal formés, découpe en lots de 100 (limite
  Expo), journalise les échecs par destinataire sans jamais bloquer le
  reste du lot.
- **Email (Resend)** — `ResendEmailProvider`, choix par défaut de
  `email.module.ts` dès maintenant aussi, mais nécessite `RESEND_API_KEY`
  et `RESEND_FROM_EMAIL` (compte à créer, domaine d'expédition à
  vérifier côté Resend) — tant qu'absentes, le backend démarre
  normalement, seul l'envoi réel échoue proprement (`failedReason`
  enregistré, jamais de crash).
- **Canal email ajouté à 8 notifications déjà existantes** : paiement
  confirmé (trajet + colis), remboursement (x2), paiement chauffeur
  reçu, colis livré, chauffeur trouvé, litige résolu/nouveau message.
- **Deux vrais trous comblés au passage**, pas seulement l'ajout du
  canal email :
  - La validation/le rejet d'un chauffeur ou d'un véhicule
    (`DriverProfilesService.verify`, `VehiclesService.verify`/`reject`)
    **ne notifiait rien du tout** avant — corrigé (push + email,
    `NotificationType.STATUS_CHANGE`).
  - **Aucun message de bienvenue à la création d'un compte** —
    ajouté pour client et chauffeur.
- **Champ email désormais collectable** : `CreateCustomerProfileDto`/
  `CreateDriverProfileDto` acceptent un `email` optionnel, qui écrit sur
  `User.email` (conflit d'unicité géré proprement — `ConflictException`
  plutôt qu'une erreur Prisma brute qui remonterait telle quelle). Le
  point d'architecture ci-dessus est donc résolu : les emails de
  bienvenue et autres notifications email ont maintenant un vrai
  destinataire pour les clients/chauffeurs qui en renseignent une.

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseigner DATABASE_URL et les secrets

# Active l'extension PostGIS sur la base avant la première migration
# (psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;")

npm run prisma:migrate     # crée les tables
npm run seed:rbac          # crée les rôles/permissions par défaut
npm run seed:accounts      # crée les comptes SuperAdmin/Support demandés (voir plus bas)
npm run start:dev          # démarre l'API sur http://localhost:3000/api/v1
```

Documentation interactive (Swagger) : `http://localhost:3000/api/docs`.

## Comptes provisionnés (`npm run seed:accounts`)

Script à exécuter une fois par environnement, après `seed:rbac`
(réexécutable sans risque — upsert par email). Comptes demandés
explicitement par le client, pas des comptes de démonstration :

| Email | Rôle | Téléphone |
|---|---|---|
| thiernodoniko@gmail.com | SuperAdmin | +33766736226 |
| thierno.diallo99@sfr.fr | Agent clientèle | +33751244722 |
| jallowdoniko@gmail.com | Superviseur clientèle | +33621158829 |
| donikojallow@gmail.com | Responsable financier | +33611435397 |

Mot de passe commun : `Lcd123456!`. Deux modes de connexion pour ces
quatre comptes :
- **Téléphone + OTP** (prioritaire, comme demandé) — fonctionne
  immédiatement pour les quatre, `verifyOtpAndLogin` ne fait aucune
  distinction de type de compte (voir `auth.service.ts`).
- **Email + mot de passe** — fonctionne immédiatement pour les 3
  comptes Support. Pour le SuperAdmin, la 2FA est obligatoire
  (section 3.1) : ce mode restera bloqué tant qu'il n'aura pas été
  configuré via `POST /auth/2fa/setup`, mais la connexion par téléphone
  reste disponible en attendant.

## Vérification effectuée avant livraison

- `schema.prisma` validé avec le moteur Prisma officiel (hors-ligne, via
  `@prisma/prisma-schema-wasm`) : 48 modèles, 26 enums, zéro erreur de
  relation, zéro doublon de table.
- Code des 9 lots plus le seed des comptes (225 fichiers `.ts`,
  l'intégralité du backend) compilé
  avec `tsc --noEmit` en mode strict, contre un
  stub TypeScript généré directement depuis le DMMF du schéma (donc
  fidèle aux vrais noms de champs/relations), en l'absence d'accès
  réseau à `binaries.prisma.sh` dans l'environnement de génération.
  **Première étape après `npm install` sur votre machine** :
  `npm run prisma:generate` remplace ce stub par le vrai client Prisma.

## Notes d'architecture

- **Argent** : tous les montants sont des `BigInt` (plus petite unité de
  la devise). Voir `common/utils/money.util.ts` et l'en-tête de
  `schema.prisma`.
- **Soft delete** : automatique via middleware Prisma pour les entités
  concernées (voir `prisma/prisma.service.ts`) — pas besoin d'ajouter
  `deletedAt: null` dans chaque requête.
- **Permissions** : catalogue centralisé dans
  `common/constants/permissions.constants.ts`. Toute nouvelle route
  protégée doit réutiliser une clé existante ou en ajouter une ici.
- **Intégrations externes** (SMS, Paiement — Cartographie à venir) :
  toujours derrière une interface (`SmsProvider`, `PaymentProviderAdapter`),
  jamais un SDK de prestataire appelé directement depuis un service
  métier — même principe que `PaymentService` dans le cahier des charges.
- **Découplage par événements** entre modules qui, sinon, s'importeraient
  circulairement (ex : Trajets/Envois ↔ Paiement pour l'annulation →
  remboursement). Voir `common/events/domain-events.ts` — un module
  émet, l'autre écoute (`@OnEvent`), aucun des deux ne connaît l'autre.
  À réutiliser pour toute future dépendance qui menacerait de créer un
  cycle plutôt que d'imposer un import direct.
