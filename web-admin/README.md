<!-- web-admin/README.md -->
# Back-office web — Plateforme régionale de transport partagé

Next.js (App Router) + TypeScript + Tailwind CSS, pour SuperAdmin et
Support. Projet séparé du mobile (`../mobile`), même backend NestJS.
Même principe de livraison que les deux autres projets : par lots
vérifiés, chaque lot réellement compilé (`tsc --noEmit` strict) avant
livraison.

Palette identique à l'app mobile (voir `mobile/src/theme/colors.ts`) —
indigo pour la marque, émeraude pour la confirmation, ambre pour
l'alerte, fond blanc cassé chaud, jamais de fond sombre. Cohérence de
marque entre les deux surfaces plutôt qu'un thème générique de tableau
de bord. Tables sobres à bordures fines pour les données tabulaires
plutôt que tout empiler en cartes à ombre identique — voir la note de
design ci-dessous.

## Lot 1 (livré) — Fondations, Authentification, Tableau de bord, Moyens de paiement

- **Un vrai problème de conception résolu avant d'écrire l'écran de
  connexion** : la 2FA est obligatoire pour le SuperAdmin (section 3.1)
  mais `/auth/2fa/setup` exige déjà une session active, alors que la
  connexion par mot de passe reste bloquée tant qu'elle n'est pas
  configurée — un blocage circulaire pour un tout premier accès. Vérifié
  dans le code source du backend (`auth.service.ts`) que la connexion
  par téléphone + OTP, elle, n'a aucune contrainte 2FA : c'est donc la
  voie d'amorçage. La page de connexion propose les deux modes (email
  principal, téléphone en repli) plutôt qu'un seul.
- **Authentification complète** : email + mot de passe (avec champ 2FA
  qui apparaît automatiquement si le backend le réclame), téléphone +
  OTP, et un écran dédié de configuration de la double authentification
  (QR code généré côté client à partir de `otpAuthUri`, plus le secret
  en repli texte).
- **Tableau de bord SuperAdmin** (`GET /dashboards/admin`) : utilisateurs,
  chauffeurs vérifiés, actifs sur 30 jours, trajets/envois, litiges
  ouverts avec taux de résolution, finances (revenu brut, commission,
  remboursements) — les vrais chiffres calculés côté backend (Lot 9
  backend), aucune valeur simulée ici non plus.
- **Moyens de paiement** — la pièce qui débloque réellement quelque
  chose : liste, création, modification, activation/désactivation.
  Résout concrètement le trou signalé pendant la livraison mobile
  (`backend/README.md`, section "Comptes provisionnés") : sans cet
  écran, il fallait appeler l'API directement pour qu'un client puisse
  payer quoi que ce soit sur la plateforme.

## Lot 2 (livré) — Utilisateurs, vérification chauffeurs/véhicules

Le RBAC prévu dans ce lot a été reporté (voir le tableau ci-dessous) —
c'est un réglage ponctuel plutôt qu'un besoin opérationnel quotidien,
moins urgent que la vérification des chauffeurs qui, elle, revient
sans cesse.

- **Utilisateurs** : liste (recherche par téléphone/email, filtre par
  rôle), détail, suspension avec motif obligatoire, réactivation.
- **Chauffeurs** : liste (recherche, filtre par statut), détail complet
  (profil, statistiques, note moyenne), véhicules avec validation/rejet
  individuel, validation/suspension/réactivation du chauffeur lui-même.
- **Un vrai trou de contrat trouvé en construisant cette page, pas
  supposé** : `GET /documents` (revue admin des pièces justificatives)
  n'accepte aucun paramètre `ownerId` — seulement `ownerType` et
  `status`, sur toute la plateforme. Impossible d'afficher de façon
  fiable "les documents de ce chauffeur précis" sans une solution de
  contournement fragile (tout récupérer puis filtrer côté client, ce qui
  casse dès que la pagination coupe avant d'atteindre le bon
  enregistrement). **La revue de documents n'est donc pas dans cette
  interface** — plutôt que de livrer quelque chose de bancal. Un
  paramètre `ownerId` optionnel sur cette route réglerait ça
  proprement ; je peux l'ajouter au backend si tu veux, mais je ne l'ai
  pas fait sans ton feu vert.

## Lot 3 (livré) — Litiges

- **Vérifié avant d'écrire l'écran d'attribution** : `support_supervisor`
  (voir `backend/src/rbac/rbac.seed.ts`) a bien `BOOKING_READ` et
  `SHIPMENT_READ` en plus de `DISPUTE_RESOLVE`/`DISPUTE_ASSIGN` — le
  contexte de la réservation/l'envoi concerné peut donc être affiché de
  façon fiable sur la fiche d'un litige pour ce rôle, contrairement au
  trou "documents" trouvé au Lot 2.
- **Liste** filtrable par statut et priorité.
- **Fiche complète** : contexte (réservation ou envoi concerné —
  montant, passagers ou expéditeur/destinataire/chauffeur selon le
  type), attribution à un agent (liste tirée des comptes Support déjà
  construite au Lot 2, pas de doublon), changement de statut de
  traitement, fil de messages avec réponse directe, et **résolution
  avec conséquence réelle** : chaque type (remboursement total/partiel,
  paiement chauffeur, annulation, suspension...) déclenche exactement
  l'action que le backend exécute derrière (voir
  `backend/src/disputes/disputes.service.ts`), avec les champs
  conditionnels qui n'apparaissent que quand le type choisi les exige
  (montant pour un remboursement partiel, identifiant utilisateur pour
  une suspension).
- Clôture du litige une fois résolu.

## Lot 4 (livré) — Paramètres, catégories d'envoi, tarification, RBAC

- **Paramètres plateforme** : table clé/valeur générique, éditeur JSON
  pour la valeur. Réservé au SuperAdmin — `SETTINGS_UPDATE` n'est
  accordée à aucun des trois rôles Support du seed.
- **Catégories d'envoi** : liste + création/édition (autorisation,
  portée pays, majoration de tarif).
- **Tarification** : commissions et politiques d'annulation sur une
  même page (deux sections), par type de service et portée pays —
  regroupées plutôt qu'éclatées en pages séparées, les deux formulaires
  étant courts et l'un n'a pas de sens sans l'autre pour un même
  réglage tarifaire.
- **RBAC** : rôles avec cases à cocher par permission (regroupées par
  domaine — `trip.*`, `dispute.*`...), et attribution/retrait d'un rôle
  ajoutés directement sur la fiche utilisateur du Lot 2 plutôt qu'un
  écran séparé — c'est là que l'action a un sens, pas dans le vide.

## Lot 5 (livré) — Retraits, géographie, notifications, traductions, audit

**Dernier lot — le back-office est maintenant complet.**

- **Retraits** : liste filtrable par statut, actions inline (passer en
  traitement, marquer payé, signaler un échec avec motif obligatoire)
  suivant exactement le cycle de vie du backend
  (`REQUESTED → PROCESSING → PAID/FAILED`).
- **Géographie** : pays, devises, puis régions/préfectures/villes en
  cascade (le choix d'un pays fait apparaître ses régions, le choix
  d'une région ses préfectures) — réglage ponctuel, pas de pages
  séparées par entité.
- **Modèles de notification** : texte par type d'évènement et canal,
  avec les `{{placeholders}}` remplacés au moment de l'envoi côté
  backend — complète le Lot 7 mobile, où ces mêmes types de
  notification n'affichaient que des libellés génériques faute de
  texte stocké ; ce lot est l'endroit où ce texte se configure
  réellement.
- **Traductions** : table générique (entité + champ + langue),
  fondation posée dès la V1 pour la Phase 2 langues.
- **Journal d'audit** : lecture seule, filtrable par type d'entité —
  trace de toutes les actions administratives des lots précédents
  (création de rôle, résolution de litige, etc.).
- La barre latérale (14 sections au total) a été réorganisée en
  groupes (Opérations, Finance, Configuration, Système) plutôt que
  listée à plat — devenait illisible sinon.

## État du projet

Les 5 lots prévus sont livrés. D'éventuelles extensions (ex: écrans
dédiés pour les preuves/évidences de litige, un vrai visualiseur de
documents une fois le trou `GET /documents` du Lot 2 comblé côté
backend) resteraient à la demande plutôt que planifiées d'avance.

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner NEXT_PUBLIC_API_URL vers votre backend

npm run dev                  # http://localhost:3000
```

Vérification avant toute modification : `npm run typecheck`.

Premier accès SuperAdmin (voir le seed du backend,
`backend/src/seed/accounts.seed.ts`) : se connecter par téléphone + OTP
d'abord (la 2FA n'est pas encore configurée), puis suivre l'écran de
configuration qui s'affiche automatiquement.

## Notes d'architecture

- **Rendu client** : ce back-office est volontairement un SPA rendu
  côté client à l'intérieur de Next.js (`'use client'` sur la quasi-
  totalité des écrans) — un outil interne à usage authentifié n'a pas
  besoin de rendu serveur ni de SEO. `Providers.tsx` bloque le rendu
  jusqu'à l'hydratation de la session.
- **Un seul point d'accès réseau** : `src/services/api/client.ts` —
  même contrat que `mobile/src/services/api/client.ts` (enveloppe
  `{success, data}`, rafraîchissement automatique du jeton sur 401,
  protection contre les rafraîchissements concurrents). Les deux
  projets sont des clients indépendants du même backend, pas de code
  partagé entre eux, mais les mêmes décisions de conception.
- **Jetons en `localStorage`**, jamais un cookie httpOnly — plus simple
  pour un outil interne à accès restreint ; voir la note de sécurité
  dans `src/services/storage/tokenStorage.ts` (même compromis que le
  repli web de l'app mobile).
- **Argent** : tous les montants transitent en `Money` (= `string`,
  jamais `number`) — reflet direct du choix BigInt→string du backend.
- **Tailwind v4** : jetons de couleur définis une fois dans
  `src/app/globals.css` (bloc `@theme`), jamais de couleur en dur dans
  un composant.
- **Design des tables** : bordures fines et lignes alternées plutôt que
  des cartes à ombre identiques pour toute donnée tabulaire (déconseillé
  explicitement pour ne pas tomber dans l'esthétique "kit SaaS
  générique") ; les cartes restent réservées à du contenu qui l'est
  réellement (un panneau de statut, un formulaire).
