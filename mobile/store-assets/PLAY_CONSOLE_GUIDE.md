<!-- mobile/store-assets/PLAY_CONSOLE_GUIDE.md -->
# Guide de remplissage — Google Play Console (Occa'Z)

Réponses prêtes à saisir dans chaque formulaire de la Play Console, cohérentes avec le code de l'application et avec la politique de
confidentialité (https://occaz.sarl/confidentialite). Date : 20 octobre 2026. Package : `sarl.occaz.app`.

## 1. Contenu de l'application › Politique de confidentialité
URL : `https://occaz.sarl/confidentialite` (la page doit être publique, sans connexion, et déployée avant la soumission).

## 2. Contenu de l'application › Sécurité des données (Data safety)

**Collecte et partage**
- L'application collecte des données : **Oui**
- Toutes les données sont chiffrées en transit : **Oui** (HTTPS)
- Les utilisateurs peuvent demander la suppression de leurs données : **Oui**
  - Dans l'application : Profil › Aide › Supprimer votre compte
  - URL web : `https://occaz.sarl/suppression-compte`
- Suit les « Families Policy » : non applicable (public adulte, 18 ans et plus)

**Types de données** (Collectées = oui ; Partagées = voir la colonne ; « Obligatoire » = nécessaire au service)

| Catégorie Google | Donnée | Collectée | Partagée | Finalité |
|---|---|---|---|---|
| Informations personnelles | Nom | Oui | Non | Fonctionnalités de l'app, gestion du compte |
| Informations personnelles | Adresse e-mail | Oui (facultatif) | Non | Gestion du compte, communications |
| Informations personnelles | ID utilisateur | Oui | Non | Fonctionnalités, gestion du compte |
| Informations personnelles | Adresse | Oui | Non | Fonctionnalités (livraison de colis) |
| Informations personnelles | Numéro de téléphone | Oui | Oui — prestataire de SMS (traitement), autre partie à une prestation | Gestion du compte, fonctionnalités, sécurité |
| Informations personnelles | Autres infos (date de naissance, pièce d'identité) | Oui (conducteurs) | Non | Vérification d'identité, sécurité |
| Informations financières | Historique des achats / paiements | Oui | Oui — prestataire de paiement | Fonctionnalités, conformité comptable |
| Informations financières | Infos de paiement (4 derniers chiffres, marque) | Oui | Non | Fonctionnalités (aucun numéro complet n'est conservé) |
| Position | Position approximative et précise | Oui | Oui — autres utilisateurs concernés (suivi du trajet) | Fonctionnalités, sécurité (SOS) |
| Messages | Autres messages dans l'app | Oui | Non | Fonctionnalités (messagerie, litiges) |
| Photos et vidéos | Photos | Oui | Non | Fonctionnalités (profil, colis, documents) |
| Fichiers et documents | Fichiers et documents | Oui (conducteurs) | Non | Vérification d'identité |
| Contacts | — | Non | — | (les contacts d'urgence sont saisis à la main, le carnet d'adresses n'est pas lu) |
| Activité dans l'app | Interactions, historique | Oui | Non | Fonctionnalités, analyses |
| Infos et performances de l'app | Journaux de plantage, diagnostics | Oui | Oui — Sentry (traitement) | Analyses, stabilité |
| Appareil ou autres ID | ID de l'appareil (jeton de notifications) | Oui | Oui — service de notifications push | Fonctionnalités |

Pour chaque donnée : « Traitée de façon éphémère » = non ; « Obligatoire » = oui sauf e-mail (facultatif) ; aucune donnée n'est utilisée pour de la publicité ou du marketing ciblé ; aucune donnée n'est vendue.
Les prestataires qui traitent les données pour notre compte (hébergement, SMS, e-mail, push, cartes, Sentry) ne comptent pas comme « partage » selon la définition de Google ; seuls sont déclarés comme partagés les destinataires à qui la donnée est communiquée pour leurs propres besoins ou celle de la prestation (autre utilisateur, prestataire de paiement).

## 3. Contenu de l'application › Autorisations sensibles › Localisation en arrière-plan
L'application déclare `ACCESS_BACKGROUND_LOCATION` et `FOREGROUND_SERVICE_LOCATION` (suivi du trajet par le conducteur).

**Description de la fonctionnalité (à saisir)** :
« Pendant un trajet en cours, le conducteur partage sa position en direct avec les passagers et les expéditeurs concernés afin qu'ils suivent son arrivée. Le suivi continue lorsque l'écran est éteint ou que le conducteur utilise une autre application, car il doit fonctionner pendant la conduite. Il démarre uniquement quand le conducteur lance le trajet et s'arrête dès la fin du trajet ; une notification permanente est affichée pendant le suivi. »

**Vidéo de démonstration (obligatoire, 30 s à 1 min, lien YouTube « non répertorié »)** à filmer sur un téléphone Android :
1. Compte conducteur : ouvrir un trajet publié, toucher « Démarrer le trajet ».
2. Montrer la fenêtre d'autorisation de localisation (« Toujours autoriser ») et le texte d'explication.
3. Quitter l'application (écran d'accueil), montrer la notification de suivi qui reste affichée.
4. Sur un second téléphone (compte client), montrer la position du véhicule qui avance.
5. Revenir sur le téléphone du conducteur, terminer le trajet et montrer que la notification disparaît.

**Service de premier plan** (type « Localisation ») : même vidéo, cocher « Localisation » et décrire : « Suivi en direct de la position du conducteur pendant un trajet en cours ».

## 4. Contenu de l'application › Applications financières
Cocher **« Mon application ne propose aucune fonction financière »** est faux ici : l'application permet des paiements et des retraits. Déclarer :
- Fonctionnalités financières : **paiement de services (réservation et envoi de colis) via des prestataires de paiement agréés, et retrait des gains des conducteurs**.
- L'application ne propose **pas** de prêts, de crypto-monnaies, de conseil en investissement ni de services bancaires propres ; le « portefeuille » d'un conducteur est un registre de sommes dues, non un compte bancaire.
- Pays visés : Guinée (puis Sénégal). Si la console demande une licence, indiquer que les paiements sont opérés par les prestataires de paiement partenaires.

## 5. Contenu de l'application › Classification du contenu (questionnaire IARC)
- Catégorie : « Utilitaire, productivité, communication ou autre » (ni jeu ni réseau social à vocation de contenu).
- Violence, sexe, langage cru, drogues, jeux d'argent : **Non** partout.
- Les utilisateurs peuvent-ils interagir ou échanger du contenu ? **Oui** (messagerie entre client et conducteur, avis) — sans contenu public.
- L'application partage-t-elle la position de l'utilisateur avec d'autres ? **Oui**.
- Achats numériques : **Non** (les paiements concernent des services physiques ; c'est autorisé hors Google Play Billing).
Résultat attendu : PEGI 3 / Tous publics, avec mention d'interaction entre utilisateurs et de partage de la position.

## 6. Contenu de l'application › Autres déclarations
- Public cible : **18 ans et plus** (les conditions générales exigent la majorité).
- Annonces publicitaires : **Non**.
- Application d'actualités : **Non**. COVID-19 : **Non**. Applications gouvernementales : **Non**.
- Identifiant publicitaire (Advertising ID) : **Non** (aucun SDK publicitaire).
- Autorisations : caméra (photos de documents, scan du billet/étiquette), photos (documents, profil), notifications, localisation. Aucun accès au micro, aux contacts, aux SMS ni au journal d'appels.

## 7. Fiche principale
Voir `listing-fr.md` (nom, descriptions, coordonnées, instructions pour l'examinateur, visuels).

## 8. Tests et mise en production
- **Compte personnel** (créé après nov. 2023) : test fermé obligatoire avec **au moins 12 testeurs inscrits pendant 14 jours consécutifs** avant de demander l'accès à la production.
- **Compte organisation** (société, avec numéro D-U-N-S) : pas de test fermé obligatoire. Utile ici, car OCCA'Z sera une société.
- Première version : téléverser **manuellement** le fichier `.aab` (le premier envoi ne peut pas se faire par `eas submit`) ; ensuite `eas submit --platform android` fonctionne avec la clé de compte de service.
- Signature : laisser Google gérer la clé (Play App Signing) ; EAS conserve la clé d'envoi.

## 9. Avant d'envoyer pour examen
- [ ] `https://occaz.sarl/confidentialite`, `/conditions` et `/suppression-compte` répondent sans connexion
- [ ] `support@occaz.sarl` reçoit bien les e-mails
- [ ] `https://api.occaz.sarl/api/v1` répond (Render, domaine personnalisé) et la variable `EXPO_PUBLIC_API_URL` du build de production pointe dessus
- [ ] Comptes de démonstration créés et testés avec le build de production
- [ ] Le numéro RCCM est renseigné dans `src/content/legal.ts` (voir note en tête de ce fichier) dès qu'il est obtenu
