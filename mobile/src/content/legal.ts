// mobile/src/content/legal.ts
// Textes juridiques d'Occa'Z (politique de confidentialité et conditions générales) — source unique partagée par l'application,
// le site https://occaz.sarl et la fiche Google Play. Ne pas modifier à la main une seule copie : le contenu est identique
// dans mobile/src/content/legal.ts et web-admin/src/content/legal.ts (et dans les fichiers .md de mobile/store-assets).
// Pour ajouter le numéro RCCM : renseigner COMPANY.rccm et la phrase correspondante dans les textes (voir section 1).

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'note'; text: string }
  | { type: 'ul'; items: string[] };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  intro: string;
  sections: LegalSection[];
}

export const COMPANY = {
  "brand": "Occa'Z",
  "legalName": "OCCA'Z",
  "legalForm": "société à responsabilité limitée (SARL) de droit guinéen",
  "registeredOffice": "quartier Daka, Labé (République de Guinée)",
  "rccm": null,
  "website": "https://occaz.sarl",
  "supportEmail": "support@occaz.sarl",
  "privacyUrl": "https://occaz.sarl/confidentialite",
  "termsUrl": "https://occaz.sarl/conditions",
  "deletionUrl": "https://occaz.sarl/suppression-compte"
} as const;

export const LEGAL_UPDATED_AT = "20 octobre 2026";
export const LEGAL_VERSION = "1.0";

export const PRIVACY_POLICY: LegalDocument = {
  "title": "Politique de confidentialité",
  "subtitle": "Vos données et vos droits",
  "intro": "Cette politique explique quelles données personnelles Occa'Z collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer vos droits. Elle s'applique à l'application mobile Occa'Z (clients et conducteurs), au site https://occaz.sarl et à l'espace d'administration de l'équipe.",
  "sections": [
    {
      "title": "1. Qui est responsable de vos données ?",
      "blocks": [
        {
          "type": "p",
          "text": "Le responsable du traitement est OCCA'Z, société à responsabilité limitée (SARL) de droit guinéen, dont le siège social est situé quartier Daka, Labé (République de Guinée). Site : https://occaz.sarl. Contact : support@occaz.sarl."
        },
        {
          "type": "p",
          "text": "Occa'Z est une plateforme numérique de mise en relation : elle met en contact des clients (voyageurs et expéditeurs) avec des conducteurs indépendants, sécurise les paiements, vérifie les conducteurs et assiste les utilisateurs. Un responsable de la conformité des données traite les demandes relatives à cette politique."
        }
      ]
    },
    {
      "title": "2. Les données que nous collectons",
      "blocks": [
        {
          "type": "p",
          "text": "Pour tous les comptes :"
        },
        {
          "type": "ul",
          "items": [
            "numéro de téléphone (identifiant du compte, vérifié par un code reçu par SMS) ;",
            "adresse e-mail (facultative pour un client ou un conducteur, vérifiée par un code) ;",
            "mot de passe ou code secret, conservé uniquement sous forme chiffrée irréversible ;",
            "appareils utilisés (type d'appareil, jeton de notifications) et sessions de connexion (dates)."
          ]
        },
        {
          "type": "p",
          "text": "Votre profil :"
        },
        {
          "type": "ul",
          "items": [
            "prénom, nom, pays, ville ;",
            "date de naissance, adresse et photo de profil, si vous les renseignez."
          ]
        },
        {
          "type": "p",
          "text": "Pour les conducteurs, en plus :"
        },
        {
          "type": "ul",
          "items": [
            "pièce d'identité, permis de conduire, carte grise et assurance du véhicule, nécessaires à la vérification obligatoire avant de proposer des trajets ou d'accepter des envois ;",
            "véhicule (marque, modèle, plaque d'immatriculation, photos) ;",
            "numéro de paiement mobile ou référence de compte pour recevoir vos retraits ;",
            "statut de vérification, badge, nombre de trajets et d'envois réalisés, notes reçues."
          ]
        },
        {
          "type": "p",
          "text": "Vos trajets et vos envois :"
        },
        {
          "type": "ul",
          "items": [
            "trajets recherchés, publiés ou réservés, places, noms des passagers que vous inscrivez ;",
            "colis : catégorie, description et contenu déclaré, poids, dimensions, valeur déclarée, photos, instructions de livraison ;",
            "expéditeur et destinataire : nom, numéro de téléphone, adresse, et adresse e-mail du destinataire si vous la donnez ;",
            "historique des étapes (prise en charge, transit, livraison) et codes de validation à usage unique."
          ]
        },
        {
          "type": "p",
          "text": "Votre position (voir aussi la section 5) :"
        },
        {
          "type": "ul",
          "items": [
            "position ponctuelle pour proposer votre adresse de départ, lorsque vous y consentez ;",
            "pour un conducteur : position en direct pendant un trajet en cours ;",
            "position transmise avec une alerte SOS."
          ]
        },
        {
          "type": "p",
          "text": "Paiements :"
        },
        {
          "type": "ul",
          "items": [
            "montant, date, statut, moyen et référence de chaque paiement, remboursement et retrait ;",
            "pour une carte enregistrée : uniquement la référence fournie par le prestataire de paiement, la marque, les quatre derniers chiffres et la date d'expiration — jamais le numéro complet ni le cryptogramme ;",
            "pour un conducteur : le solde et les mouvements de son portefeuille."
          ]
        },
        {
          "type": "p",
          "text": "Échanges et sécurité :"
        },
        {
          "type": "ul",
          "items": [
            "messages échangés par la messagerie de l'application ;",
            "litiges (messages, photos et documents joints), signalements, utilisateurs bloqués, notes et avis ;",
            "contacts d'urgence que vous enregistrez (nom et numéro) ;",
            "codes promotionnels utilisés et lien de parrainage."
          ]
        },
        {
          "type": "p",
          "text": "Données techniques et site web :"
        },
        {
          "type": "ul",
          "items": [
            "adresse IP et journaux de connexion, utiles à la sécurité ;",
            "rapports d'erreurs techniques de l'application (sans le contenu de vos messages) ;",
            "sur le site : votre choix concernant les cookies, avec sa date, sa version, votre adresse IP et votre navigateur."
          ]
        },
        {
          "type": "p",
          "text": "Nous n'utilisons aucun identifiant publicitaire et l'application ne contient aucun outil de publicité ciblée."
        }
      ]
    },
    {
      "title": "3. Les personnes dont vous nous donnez les coordonnées",
      "blocks": [
        {
          "type": "p",
          "text": "Pour envoyer un colis, vous nous communiquez des données sur le destinataire et l'expéditeur ; pour réserver pour d'autres, sur les passagers ; pour votre sécurité, sur vos contacts d'urgence. Vous ne devez saisir que des informations que vous avez le droit de communiquer. Ces personnes disposent des mêmes droits que vous (section 10) et peuvent nous écrire à support@occaz.sarl."
        },
        {
          "type": "p",
          "text": "Le destinataire d'un colis peut recevoir un SMS ou un e-mail de suivi et le code de remise ; les contacts d'urgence reçoivent un SMS uniquement si vous déclenchez une alerte SOS."
        }
      ]
    },
    {
      "title": "4. Pourquoi nous utilisons ces données",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "créer et sécuriser votre compte, vous authentifier ;",
            "mettre en relation clients et conducteurs, calculer les prix, enregistrer vos réservations et vos envois (exécution du contrat) ;",
            "vérifier l'identité et les documents des conducteurs (sécurité de la plateforme) ;",
            "permettre le suivi d'un trajet ou d'un colis, et la validation des étapes par code ;",
            "traiter les paiements, les remboursements, les commissions et les retraits ;",
            "assurer la sécurité : alertes SOS, signalements, blocages, lutte contre la fraude et les usages interdits ;",
            "répondre à vos demandes, instruire les litiges ;",
            "vous envoyer des notifications liées à votre activité (réservation, conducteur trouvé, colis livré, rappels de départ) ;",
            "respecter nos obligations légales, comptables et répondre aux demandes des autorités ;",
            "avec votre accord seulement : envoyer des offres promotionnelles et mesurer l'audience du site."
          ]
        },
        {
          "type": "p",
          "text": "Ces traitements reposent, selon le cas, sur l'exécution du contrat conclu avec vous (conditions générales), sur votre consentement (localisation, notifications, cookies de mesure d'audience), sur notre intérêt légitime à protéger la plateforme et ses utilisateurs, et sur nos obligations légales. Nous ne vendons jamais vos données personnelles."
        }
      ]
    },
    {
      "title": "5. Votre position",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Client : l'application peut demander votre position ponctuelle pour remplir votre adresse de départ. Rien n'est suivi en continu.",
            "Conducteur : pendant un trajet en cours, l'application partage votre position avec les passagers et les expéditeurs concernés, pour qu'ils suivent votre arrivée. Pour que ce suivi continue lorsque l'écran est éteint ou que vous utilisez une autre application, l'application demande l'autorisation de localisation en arrière-plan et affiche une notification pendant le trajet. Le suivi s'arrête à la fin du trajet.",
            "Seule la dernière position connue du trajet est conservée ; elle n'est plus mise à jour une fois le trajet terminé.",
            "Alerte SOS : la position envoyée avec l'alerte est transmise à l'équipe d'assistance et résumée dans le SMS adressé à vos contacts d'urgence."
          ]
        },
        {
          "type": "p",
          "text": "Vous pouvez à tout moment retirer l'autorisation de localisation dans les réglages de votre téléphone ; certaines fonctions (suivi du trajet, remplissage automatique de l'adresse) ne seront alors plus disponibles."
        }
      ]
    },
    {
      "title": "6. Colis : contrôle du contenu et responsabilité",
      "blocks": [
        {
          "type": "note",
          "text": "Les conducteurs ont le droit de vérifier le contenu des colis qu'ils transportent, et il leur est vivement conseillé de le faire avant chaque prise en charge, en présence de l'expéditeur. À défaut de vérification, Occa'Z décline toute responsabilité si un colis contient des produits prohibés ou illicites : Occa'Z ne voit, n'ouvre et ne contrôle aucun colis."
        },
        {
          "type": "p",
          "text": "Le client doit déclarer exactement le contenu de son colis et accepter que le conducteur le vérifie. Le conducteur peut refuser tout colis dont il ne peut pas vérifier le contenu ou qui lui paraît suspect. Sont interdits notamment :"
        },
        {
          "type": "ul",
          "items": [
            "stupéfiants et substances illicites ;",
            "armes, munitions et explosifs ;",
            "produits inflammables, toxiques, radioactifs, corrosifs ou autrement dangereux ;",
            "marchandises contrefaites, volées ou de provenance douteuse, y compris les médicaments falsifiés ;",
            "espèces, bijoux ou valeurs en quantité importante, sauf déclaration exacte et acceptation expresse du conducteur ;",
            "animaux vivants, espèces protégées et produits qui en sont issus ;",
            "denrées périssables non conditionnées pour le voyage ;",
            "tout produit dont le transport, l'importation ou l'exportation est interdit ou soumis à autorisation dans le pays de départ, de transit ou d'arrivée."
          ]
        },
        {
          "type": "p",
          "text": "Occa'Z n'est pas transporteur et ne peut pas connaître le contenu réel d'un colis : la responsabilité civile et pénale du transport d'un produit prohibé incombe à l'expéditeur qui a fait une fausse déclaration et au conducteur qui a accepté le colis sans le vérifier. Les informations déclarées (contenu, photos, identités, trajet) sont conservées et peuvent être communiquées aux autorités compétentes sur réquisition. Occa'Z peut suspendre ou fermer le compte de tout utilisateur qui enfreint ces règles."
        }
      ]
    },
    {
      "title": "7. Avec qui nous partageons vos données",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "L'autre partie à une prestation : un conducteur voit le nom, la photo et les informations utiles d'un client ou d'un colis qu'il prend en charge ; un client voit le profil, le véhicule, la note et, pendant le trajet, la position du conducteur. Les coordonnées ne sont partagées que dans la mesure nécessaire.",
            "L'équipe d'assistance et d'administration d'Occa'Z, dont l'accès est limité à ce que chaque fonction exige (rôles), et dont les consultations sont journalisées.",
            "Nos prestataires techniques, qui n'agissent que sur nos instructions : hébergement du serveur et de la base de données, stockage des fichiers, envoi de SMS et d'e-mails, notifications push, cartes et recherche d'adresses, suivi des erreurs, hébergement du site.",
            "Les prestataires de paiement (Orange Money et autres services de paiement mobile, carte bancaire, virement), qui traitent les paiements et les retraits selon leurs propres règles.",
            "Les autorités compétentes, lorsque la loi ou une décision de justice l'exige."
          ]
        },
        {
          "type": "p",
          "text": "Certains de ces prestataires sont situés hors de Guinée. Nous ne leur transférons que les données nécessaires et choisissons des prestataires qui offrent un niveau de protection adéquat, conformément à la loi applicable."
        }
      ]
    },
    {
      "title": "8. Combien de temps nous conservons vos données",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Compte actif : pendant toute la durée de vie du compte.",
            "Suppression à votre demande : le compte est désactivé immédiatement ; vos données personnelles sont effacées ou anonymisées au plus tard 30 jours après la demande, à l'exception de celles que la loi nous oblige à conserver.",
            "Compte suspendu : sans réactivation pendant 6 mois, le compte est définitivement supprimé. Si une adresse e-mail est enregistrée, un rappel mensuel vous invite à vous rapprocher de l'administration.",
            "Pièces d'identité, permis, carte grise et assurance : supprimés avec le compte.",
            "Paiements, remboursements, commissions et mouvements de portefeuille : conservés pendant la durée légale des pièces comptables (en principe dix ans), sous forme dissociée de votre identité lorsque le compte est supprimé.",
            "Litiges, signalements et messages liés : pendant le traitement du litige puis le temps de la prescription ; les textes que vous avez écrits sont effacés lors de la suppression du compte.",
            "Codes de vérification : valables quelques minutes, jamais conservés en clair.",
            "Position d'une alerte SOS : le temps du traitement de l'alerte, puis effacée lors de la suppression du compte.",
            "Preuve de votre choix sur les cookies : le temps nécessaire pour démontrer votre consentement."
          ]
        },
        {
          "type": "p",
          "text": "Si votre compte comporte encore un solde de portefeuille, un retrait ou un litige en cours, ou un trajet, une réservation ou un envoi non terminé, la suppression attend que la situation soit réglée."
        }
      ]
    },
    {
      "title": "9. La sécurité de vos données",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Les échanges entre l'application, le site et nos serveurs sont chiffrés.",
            "Les mots de passe et les codes de vérification sont stockés sous forme chiffrée irréversible.",
            "Les pièces d'identité et documents sensibles sont stockés dans un espace privé et ne sont lisibles que par des liens temporaires, jamais par une adresse publique permanente.",
            "Aucune donnée complète de carte bancaire n'est conservée par Occa'Z.",
            "L'accès aux données est limité par rôle, les actions sensibles de l'équipe sont journalisées, et l'authentification à deux facteurs est obligatoire pour le super-administrateur et proposée aux autres membres de l'équipe."
          ]
        },
        {
          "type": "p",
          "text": "Si une violation de données est susceptible de vous causer un préjudice, nous vous en informons et prévenons l'autorité compétente lorsque la loi l'exige."
        }
      ]
    },
    {
      "title": "10. Vos droits et comment les exercer",
      "blocks": [
        {
          "type": "p",
          "text": "Dans les conditions prévues par la loi applicable (en Guinée, la loi L/2016/037/AN du 28 juillet 2016 relative à la cybersécurité et à la protection des données à caractère personnel, et les engagements de la CEDEAO en la matière), vous pouvez :"
        },
        {
          "type": "ul",
          "items": [
            "accéder à vos données et en obtenir une copie ;",
            "faire rectifier vos informations (la plupart sont modifiables dans l'application, depuis votre profil) ;",
            "demander la suppression de votre compte et de vos données ;",
            "vous opposer à un traitement, notamment à la prospection commerciale, gratuitement ;",
            "retirer à tout moment un consentement donné (localisation, notifications, cookies), sans effet sur ce qui a eu lieu avant."
          ]
        },
        {
          "type": "p",
          "text": "Pour supprimer votre compte : dans l'application, ouvrez Profil, puis Aide, puis « Supprimer votre compte » ; ou, sans l'application, rendez-vous sur https://occaz.sarl/suppression-compte ; ou écrivez à support@occaz.sarl depuis l'adresse ou en indiquant le numéro de téléphone du compte. Pour toute autre demande, écrivez à support@occaz.sarl. Nous répondons dans un délai maximal de 30 jours et pouvons vous demander de justifier votre identité."
        },
        {
          "type": "p",
          "text": "Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l'autorité de protection des données compétente dès qu'elle est opérationnelle, ou les juridictions compétentes."
        }
      ]
    },
    {
      "title": "11. Cookies et traceurs",
      "blocks": [
        {
          "type": "p",
          "text": "Le site utilise des cookies strictement nécessaires à son fonctionnement (par exemple pour maintenir votre session). Les cookies de mesure d'audience ne sont déposés qu'avec votre accord, que vous pouvez donner ou refuser dans le bandeau affiché à votre première visite ; votre choix est enregistré et peut être modifié à tout moment. L'application mobile ne dépose aucun cookie publicitaire."
        }
      ]
    },
    {
      "title": "12. Utilisateurs mineurs",
      "blocks": [
        {
          "type": "p",
          "text": "Occa'Z s'adresse aux personnes âgées d'au moins 18 ans. Nous ne collectons pas sciemment de données concernant des mineurs ; si vous pensez qu'un mineur nous a fourni des informations, écrivez-nous à support@occaz.sarl et nous les supprimerons."
        }
      ]
    },
    {
      "title": "13. Modifications de cette politique",
      "blocks": [
        {
          "type": "p",
          "text": "Nous pouvons mettre à jour cette politique, notamment si le service ou la loi évolue. La date de dernière mise à jour figure en haut de la page ; en cas de changement important, nous vous en informons dans l'application avant son entrée en vigueur."
        }
      ]
    },
    {
      "title": "14. Nous contacter",
      "blocks": [
        {
          "type": "p",
          "text": "OCCA'Z — quartier Daka, Labé (République de Guinée). E-mail : support@occaz.sarl. Site : https://occaz.sarl."
        }
      ]
    }
  ]
};

export const TERMS_OF_USE: LegalDocument = {
  "title": "Conditions générales",
  "subtitle": "Les règles d'utilisation",
  "intro": "Les présentes conditions générales régissent l'utilisation de l'application mobile Occa'Z, du site https://occaz.sarl et des services associés. En créant un compte ou en utilisant le service, vous les acceptez.",
  "sections": [
    {
      "title": "1. Qui sommes-nous ?",
      "blocks": [
        {
          "type": "p",
          "text": "Occa'Z est édité par OCCA'Z, société à responsabilité limitée (SARL) de droit guinéen, dont le siège social est situé quartier Daka, Labé (République de Guinée). Contact : support@occaz.sarl."
        }
      ]
    },
    {
      "title": "2. Ce que fait Occa'Z",
      "blocks": [
        {
          "type": "p",
          "text": "Occa'Z est une plateforme numérique de mise en relation. Elle permet à des conducteurs indépendants de proposer des trajets en partage de véhicule et d'accepter d'acheminer des colis, et à des clients de réserver une place ou d'envoyer un colis. Occa'Z fournit la technologie, la vérification des conducteurs, la sécurisation des paiements, le suivi des prestations et l'assistance."
        },
        {
          "type": "p",
          "text": "Occa'Z n'est ni transporteur, ni loueur de véhicules, et n'emploie pas les conducteurs. Le contrat de transport est conclu directement entre le conducteur et le client ; Occa'Z n'est pas partie à ce contrat."
        }
      ]
    },
    {
      "title": "3. Compte et accès",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Vous devez avoir au moins 18 ans et la capacité de contracter.",
            "L'inscription exige un numéro de téléphone valide, vérifié par code. Les informations que vous fournissez doivent être exactes et tenues à jour.",
            "Vous êtes responsable de la confidentialité de vos identifiants et des actions faites depuis votre compte. Ne communiquez jamais votre mot de passe ni un code de validation, même à une personne qui se présente comme Occa'Z.",
            "Un même compte permet d'agir comme client et, une fois validé, comme conducteur."
          ]
        }
      ]
    },
    {
      "title": "4. Les conducteurs",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Un conducteur agit en professionnel ou en particulier indépendant, avec son propre véhicule. Il est seul responsable de son véhicule, de son permis de conduire, de son assurance, de ses obligations fiscales et sociales et du respect du code de la route.",
            "Avant toute activité, il fournit sa pièce d'identité, son permis, la carte grise et l'assurance de son véhicule ; ces pièces sont contrôlées par l'équipe, qui peut refuser ou suspendre un compte, avec un motif. Un badge « vérifié » signale un dossier validé.",
            "Il publie des trajets et des prix exacts, respecte les horaires et les arrêts annoncés, et n'accepte que des colis qu'il peut transporter légalement et en sécurité.",
            "Il ne demande ni n'accepte aucun paiement en dehors de l'application pour une prestation réservée sur la plateforme."
          ]
        }
      ]
    },
    {
      "title": "5. Réservation et trajet",
      "blocks": [
        {
          "type": "p",
          "text": "Le prix de chaque place ou tronçon est affiché avant la réservation. La réservation est confirmée après le paiement. Pour confirmer la prise en charge puis la dépose d'un passager, le client communique au conducteur un code à usage unique ; le conducteur ne peut pas valider seul ces étapes. Le client suit la position du véhicule pendant le trajet."
        }
      ]
    },
    {
      "title": "6. Envoi de colis",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Le client décrit son colis avec exactitude (catégorie, contenu, poids, dimensions, valeur déclarée), indique l'expéditeur, le destinataire et les adresses, et choisit la période de départ. Le premier conducteur qui accepte la demande en est chargé.",
            "Seules les catégories de colis proposées dans l'application sont acceptées, dans la limite de la valeur déclarée maximale indiquée. La déclaration du contenu est obligatoire.",
            "La prise en charge et la livraison sont confirmées par des codes à usage unique remis au client et au destinataire."
          ]
        },
        {
          "type": "note",
          "text": "Les conducteurs ont le droit de vérifier le contenu des colis qu'ils transportent, et il leur est vivement conseillé de le faire avant chaque prise en charge, en présence de l'expéditeur. À défaut de vérification, Occa'Z décline toute responsabilité si un colis contient des produits prohibés ou illicites : Occa'Z ne voit, n'ouvre et ne contrôle aucun colis."
        },
        {
          "type": "p",
          "text": "Le client accepte que le conducteur vérifie le contenu du colis et déclare qu'il ne contient aucun des articles interdits suivants :"
        },
        {
          "type": "ul",
          "items": [
            "stupéfiants et substances illicites ;",
            "armes, munitions et explosifs ;",
            "produits inflammables, toxiques, radioactifs, corrosifs ou autrement dangereux ;",
            "marchandises contrefaites, volées ou de provenance douteuse, y compris les médicaments falsifiés ;",
            "espèces, bijoux ou valeurs en quantité importante, sauf déclaration exacte et acceptation expresse du conducteur ;",
            "animaux vivants, espèces protégées et produits qui en sont issus ;",
            "denrées périssables non conditionnées pour le voyage ;",
            "tout produit dont le transport, l'importation ou l'exportation est interdit ou soumis à autorisation dans le pays de départ, de transit ou d'arrivée."
          ]
        },
        {
          "type": "p",
          "text": "Le conducteur peut refuser tout colis dont il ne peut pas vérifier le contenu ou qui lui paraît suspect. Celui qui transporte un colis sans l'avoir vérifié le fait à ses risques. Occa'Z décline toute responsabilité à raison des produits prohibés ou illicites qu'un colis contiendrait, dont elle ne peut ni connaître ni contrôler le contenu ; la responsabilité en incombe à l'expéditeur qui a fait une fausse déclaration et au conducteur qui a accepté le colis sans le vérifier, y compris devant les autorités. Occa'Z peut communiquer aux autorités compétentes, sur réquisition, les informations dont elle dispose, et suspendre ou fermer tout compte concerné."
        }
      ]
    },
    {
      "title": "7. Prix, commission et paiement",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Les prix sont exprimés dans la monnaie du pays concerné. Le total, comprenant les frais de service éventuels et les majorations (envoi urgent, certaines catégories de colis), est affiché avant le paiement.",
            "Le paiement s'effectue en ligne par l'intermédiaire de prestataires de paiement tiers (paiement mobile, carte bancaire ou virement selon disponibilité). Occa'Z ne conserve aucune donnée complète de carte.",
            "Occa'Z perçoit une commission sur chaque trajet et chaque envoi, déduite de la somme revenant au conducteur.",
            "La part du conducteur est inscrite dans son portefeuille une fois la prestation confirmée par les codes. Le conducteur demande ensuite un retrait vers son compte de paiement mobile ou bancaire ; le solde du portefeuille représente les sommes qui lui sont dues, et n'est ni un compte bancaire ni de la monnaie électronique."
          ]
        }
      ]
    },
    {
      "title": "8. Annulation et remboursement",
      "blocks": [
        {
          "type": "p",
          "text": "Les conditions d'annulation et de remboursement, qui varient selon le pays et le type de prestation, sont affichées dans l'application au moment de la réservation ou de l'envoi. Si aucun conducteur n'est trouvé pour un envoi dans la période choisie, le client peut prolonger la période ou être remboursé intégralement. Les remboursements sont versés par le même moyen que le paiement, dans les délais du prestataire."
        }
      ]
    },
    {
      "title": "9. Règles de conduite",
      "blocks": [
        {
          "type": "p",
          "text": "Chaque utilisateur s'engage à se comporter de façon loyale et respectueuse, et à ne pas :"
        },
        {
          "type": "ul",
          "items": [
            "fournir de fausses informations, usurper une identité ou créer plusieurs comptes pour contourner une sanction ;",
            "harceler, menacer ou discriminer, ou tenir des propos illégaux dans la messagerie ou les avis ;",
            "contourner la plateforme pour éviter la commission, ou valider une étape sans qu'elle ait eu lieu ;",
            "transporter ou faire transporter des articles interdits (article 6) ;",
            "utiliser l'application pour une activité illégale, ou perturber son fonctionnement."
          ]
        }
      ]
    },
    {
      "title": "10. Sécurité, signalements et sanctions",
      "blocks": [
        {
          "type": "p",
          "text": "L'application propose une alerte SOS (avec position et prévenance de vos contacts d'urgence), le signalement et le blocage d'un utilisateur, ainsi que des rappels de départ. Occa'Z peut avertir, restreindre, suspendre ou fermer un compte en cas de manquement, de fraude ou de risque pour autrui ; la décision est motivée et peut être contestée auprès de l'assistance. En cas de danger immédiat, contactez d'abord les secours."
        }
      ]
    },
    {
      "title": "11. Litiges et assistance",
      "blocks": [
        {
          "type": "p",
          "text": "Tout client ou conducteur peut ouvrir un litige depuis l'application, joindre des preuves et échanger avec l'assistance. L'équipe peut décider d'un remboursement total ou partiel, du paiement du conducteur ou d'une sanction ; chaque décision est enregistrée. Les parties restent libres de saisir les juridictions compétentes."
        }
      ]
    },
    {
      "title": "12. Responsabilité",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Occa'Z s'efforce d'assurer le bon fonctionnement de la plateforme, sans garantir l'absence d'interruption ou d'erreur.",
            "Occa'Z répond de ses propres manquements, mais n'est pas responsable de l'exécution du transport, qui relève du conducteur : retard, annulation, perte ou dommage causé au colis ou à une personne, conduite, état du véhicule ou absence d'assurance du conducteur.",
            "Occa'Z n'est pas responsable du contenu des colis (article 6), ni des informations inexactes données par un utilisateur.",
            "Aucune partie n'est responsable d'un manquement causé par un événement de force majeure (coupure de réseau, intempéries, état des routes, décision d'une autorité…).",
            "Rien dans ces conditions ne limite une responsabilité qui ne peut l'être selon la loi."
          ]
        }
      ]
    },
    {
      "title": "13. Données personnelles",
      "blocks": [
        {
          "type": "p",
          "text": "Le traitement de vos données est décrit dans la politique de confidentialité (https://occaz.sarl/confidentialite), qui fait partie des présentes conditions."
        }
      ]
    },
    {
      "title": "14. Propriété intellectuelle",
      "blocks": [
        {
          "type": "p",
          "text": "L'application, le site, la marque Occa'Z, le logo, les bases de données et les contenus sont la propriété de OCCA'Z ou de ses concédants. Toute reproduction ou extraction non autorisée est interdite. Vous nous concédez le droit d'afficher les contenus que vous publiez (photo de profil, avis, messages) pour les besoins du service."
        }
      ]
    },
    {
      "title": "15. Fermeture du compte",
      "blocks": [
        {
          "type": "p",
          "text": "Vous pouvez fermer votre compte à tout moment depuis l'application (Profil, Aide, « Supprimer votre compte ») ou sur https://occaz.sarl/suppression-compte, une fois vos réservations, envois et trajets en cours terminés ou annulés. Les conséquences sur vos données sont décrites dans la politique de confidentialité."
        }
      ]
    },
    {
      "title": "16. Modification des conditions",
      "blocks": [
        {
          "type": "p",
          "text": "Occa'Z peut modifier ces conditions. Toute modification importante vous est notifiée dans l'application avant son entrée en vigueur ; continuer à utiliser le service après cette date vaut acceptation."
        }
      ]
    },
    {
      "title": "17. Droit applicable et litiges",
      "blocks": [
        {
          "type": "p",
          "text": "Les présentes conditions sont soumises au droit de la République de Guinée, y compris les Actes uniformes de l'OHADA applicables en matière commerciale. Tout différend qui n'a pas pu être résolu à l'amiable avec l'assistance (support@occaz.sarl) relève des juridictions compétentes de la République de Guinée."
        }
      ]
    },
    {
      "title": "18. Contact",
      "blocks": [
        {
          "type": "p",
          "text": "OCCA'Z — quartier Daka, Labé (République de Guinée). E-mail : support@occaz.sarl. Site : https://occaz.sarl."
        }
      ]
    }
  ]
};
