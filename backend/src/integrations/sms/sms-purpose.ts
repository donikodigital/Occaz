// backend/src/integrations/sms/sms-purpose.ts
// [19/10/2026] v2 — Le changement de numéro (Client et Conducteur) devient un 4e motif ouvert : le code est TOUJOURS envoyé par SMS au NOUVEAU
// numéro (preuve qu'on le possède). L'alerte envoyée à l'ANCIEN numéro est un motif à part (PHONE_CHANGE_ALERT), fermé par défaut : elle part
// par e-mail. L'équipe (Support, SuperAdmin) ne reçoit jamais de SMS : son code de changement de numéro part par e-mail.
// [19/10/2026] v1 — Politique d'envoi des SMS : un SMS coûte cher (environ 0,24 € vers la Guinée avec Infobip), on ne l'envoie donc que
// pour quatre motifs :
//   1. SIGNUP            — vérifier le numéro à la création d'un compte Client ou Conducteur ;
//   2. PASSWORD_RESET    — récupérer un mot de passe oublié ;
//   3. PARCEL_RECIPIENT  — code de livraison envoyé au DESTINATAIRE d'un colis (il n'a pas besoin de compte Occa'Z) ;
//   4. PHONE_CHANGE      — code de changement de numéro envoyé au NOUVEAU numéro d'un Client ou d'un Conducteur.
// Tout autre motif est refusé par défaut (alerte à l'ancien numéro, codes de prise en charge, notifications, SOS, connexion par SMS…) : le
// code reste affiché dans l'application et la notification part par push ou e-mail.
//
// Retour en arrière sans redéployer le code : SMS_EXTRA_PURPOSES=SOS,PHONE_CHANGE_ALERT (liste des motifs à réactiver, séparés par des virgules).

export enum SmsPurpose {
  SIGNUP = 'SIGNUP',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PARCEL_RECIPIENT = 'PARCEL_RECIPIENT',
  /** Code de changement de numéro, envoyé au NOUVEAU numéro (Client et Conducteur uniquement). */
  PHONE_CHANGE = 'PHONE_CHANGE',

  // Motifs fermés par défaut.
  /** SMS d'alerte envoyé à l'ANCIEN numéro après un changement (par défaut l'alerte part par e-mail). */
  PHONE_CHANGE_ALERT = 'PHONE_CHANGE_ALERT',
  LOGIN = 'LOGIN',
  HANDOVER = 'HANDOVER',
  NOTIFICATION = 'NOTIFICATION',
  SOS = 'SOS',
}

/** Les seuls motifs ouverts sans réglage particulier. */
export const DEFAULT_ALLOWED_SMS_PURPOSES: readonly SmsPurpose[] = [
  SmsPurpose.SIGNUP,
  SmsPurpose.PASSWORD_RESET,
  SmsPurpose.PARCEL_RECIPIENT,
  SmsPurpose.PHONE_CHANGE,
];

/** Motifs réactivés par SMS_EXTRA_PURPOSES (valeurs inconnues ignorées). */
export function extraSmsPurposes(env: NodeJS.ProcessEnv = process.env): SmsPurpose[] {
  const known = new Set<string>(Object.values(SmsPurpose));
  return (env.SMS_EXTRA_PURPOSES ?? '')
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is SmsPurpose => known.has(entry));
}

export function isSmsPurposeAllowed(purpose: SmsPurpose | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!purpose) return false;
  return DEFAULT_ALLOWED_SMS_PURPOSES.includes(purpose) || extraSmsPurposes(env).includes(purpose);
}

/** Erreur levée quand un SMS est refusé par la politique — jamais une panne du prestataire. */
export class SmsPurposeNotAllowedError extends Error {
  constructor(readonly purpose: SmsPurpose | undefined) {
    super(
      `SMS refusé par la politique d'envoi (motif ${purpose ?? 'non précisé'}) : seuls l'inscription, le mot de passe oublié, le destinataire d'un colis et le nouveau numéro d'un changement de numéro envoient un SMS.`,
    );
    this.name = 'SmsPurposeNotAllowedError';
  }
}
