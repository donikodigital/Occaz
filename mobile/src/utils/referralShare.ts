// mobile/src/utils/referralShare.ts
//
// [07/10/2026] v1 — Message de parrainage partagé par l'écran « Parrainez des amis » (client et conducteur). Il contient :
//  - le lien de la page d'invitation du site (https://occaz.sarl/rejoindre?code=…), qui montre le code et mène à l'installation ;
//  - le code en clair, et où le saisir (le champ « Un code à saisir ? » est dans Profil › Parrainez des amis, pas à l'inscription).
//
// L'adresse du site se change sans toucher au code : variable EXPO_PUBLIC_WEB_URL (EAS), sinon https://occaz.sarl.

const DEFAULT_WEB_URL = 'https://occaz.sarl';

function webBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  return (configured || DEFAULT_WEB_URL).replace(/\/+$/, '');
}

/** Lien de la page d'invitation, avec le code du parrain. */
export function referralInviteLink(code: string): string {
  return `${webBaseUrl()}/rejoindre?code=${encodeURIComponent(code)}`;
}

/** Texte envoyé par WhatsApp, SMS, etc. quand on touche « Partager mon code ». */
export function buildReferralShareMessage(code: string): string {
  return [
    "Rejoins-moi sur Occa'Z, l'appli de transport partagé et d'envoi de colis !",
    '',
    `Installe-la ici : ${referralInviteLink(code)}`,
    '',
    `Après ton inscription, va dans Profil › Parrainez des amis et saisis mon code : ${code}`,
  ].join('\n');
}
