// backend/src/tracking/tracking-emails.ts
// [10/10/2026] v1 — textes des e-mails de suivi envoyés à l'expéditeur et au destinataire (fonctions pures, testées).
//
// Aucun code à 6 chiffres (prise en charge, livraison) dans ces e-mails : ils passent par SMS et par l'application, jamais par un
// e-mail qui peut être transféré. Le destinataire n'y voit ni téléphone ni adresse précise.

export type TrackedStatus = 'DRIVER_ASSIGNED' | 'PICKED_UP' | 'DELIVERY_PENDING' | 'DELIVERED';
export type TrackingAudience = 'SENDER' | 'RECIPIENT';

/** Qui reçoit un e-mail à quelle étape. L'expéditeur est déjà prévenu par ailleurs du conducteur trouvé et de la livraison. */
export const EMAIL_AUDIENCES: Record<TrackedStatus, readonly TrackingAudience[]> = {
  DRIVER_ASSIGNED: ['RECIPIENT'],
  PICKED_UP: ['SENDER', 'RECIPIENT'],
  DELIVERY_PENDING: ['SENDER', 'RECIPIENT'],
  DELIVERED: ['RECIPIENT'],
};

export interface TrackingEmailContext {
  audience: TrackingAudience;
  status: TrackedStatus;
  /** Prénom du destinataire de l'e-mail (expéditeur : prénom du profil ; destinataire : prénom saisi). */
  firstName: string;
  senderName: string;
  pickupCity: string;
  deliveryCity: string;
  driverFirstName: string | null;
  parcelsCount: number;
  trackingNumber: string;
  /** Lien de la page de suivi, quand l'adresse publique est configurée. */
  trackingUrl: string | null;
}

export function isTrackedStatus(status: string): status is TrackedStatus {
  return status in EMAIL_AUDIENCES;
}

export function trackingEmail(context: TrackingEmailContext): { subject: string; body: string } {
  const { audience, status, firstName, senderName, pickupCity, deliveryCity, trackingNumber, trackingUrl } = context;
  const driver = context.driverFirstName ?? 'Le conducteur';
  const parcels = context.parcelsCount > 1 ? `${context.parcelsCount} colis` : 'colis';
  const route = `${pickupCity} → ${deliveryCity}`;

  let subject: string;
  let lines: string[];

  if (audience === 'RECIPIENT') {
    switch (status) {
      case 'DRIVER_ASSIGNED':
        subject = `Un colis vous est destiné · ${trackingNumber}`;
        lines = [`${senderName} vous envoie ${context.parcelsCount > 1 ? `${context.parcelsCount} colis` : 'un colis'} (${route}).`, `${driver} va le récupérer. Vous pourrez le suivre ici, de la prise en charge jusqu'à la livraison.`];
        break;
      case 'PICKED_UP':
        subject = `Votre colis est en route · ${trackingNumber}`;
        lines = [`${driver} vient de récupérer ${context.parcelsCount > 1 ? 'vos ' + parcels : 'votre colis'} à ${pickupCity}. Il est en route vers ${deliveryCity}.`];
        break;
      case 'DELIVERY_PENDING':
        subject = `Votre colis arrive · ${trackingNumber}`;
        lines = [
          `${driver} est arrivé à ${deliveryCity} avec ${context.parcelsCount > 1 ? 'vos ' + parcels : 'votre colis'}.`,
          'Un code à 6 chiffres vous est envoyé par SMS : donnez-le au conducteur uniquement au moment de recevoir le colis.',
        ];
        break;
      default:
        subject = `Colis livré · ${trackingNumber}`;
        lines = [`${context.parcelsCount > 1 ? 'Vos ' + parcels + ' ont été livrés' : 'Votre colis a été livré'} à ${deliveryCity}. Merci d'avoir utilisé Occa'Z.`];
    }
  } else {
    switch (status) {
      case 'PICKED_UP':
        subject = `Colis récupéré · ${trackingNumber}`;
        lines = [`${driver} a récupéré ${context.parcelsCount > 1 ? 'vos ' + parcels : 'votre colis'} à ${pickupCity}. Il est en route vers ${deliveryCity}.`, 'Vous pouvez suivre sa progression ville par ville.'];
        break;
      case 'DELIVERY_PENDING':
        subject = `Votre colis arrive chez le destinataire · ${trackingNumber}`;
        lines = [`${driver} est arrivé à ${deliveryCity}. Le destinataire va recevoir son code de livraison par SMS (vous le retrouvez aussi dans l'application).`];
        break;
      default:
        subject = `Suivi du colis · ${trackingNumber}`;
        lines = [`Votre envoi ${route} a évolué.`];
    }
  }

  const body = [
    `Bonjour ${firstName},`,
    '',
    ...lines,
    '',
    `Numéro de suivi : ${trackingNumber}`,
    trackingUrl ? `Suivi en direct : ${trackingUrl}` : "Suivi en direct : ouvrez « Suivre un colis » dans l'application Occa'Z et saisissez ce numéro.",
  ].join('\n');

  return { subject, body };
}

/** Texte d'une notification dans l'application quand le colis passe dans une ville traversée. */
export function passageNotification(cityName: string, trackingNumber: string): { title: string; body: string } {
  return { title: 'Votre colis avance', body: `Votre colis (${trackingNumber}) vient de passer par ${cityName}.` };
}

/** Texte d'une notification dans l'application pour l'expéditeur à une étape du colis. */
export function statusNotification(status: TrackedStatus, params: { deliveryCity: string; driverFirstName: string | null }): { title: string; body: string } | null {
  const driver = params.driverFirstName ?? 'Le conducteur';
  switch (status) {
    case 'PICKED_UP':
      return { title: 'Colis récupéré', body: `${driver} a récupéré votre colis. Suivez-le en direct dans l'application.` };
    case 'DELIVERY_PENDING':
      return { title: 'Votre colis est arrivé', body: `${driver} est arrivé à ${params.deliveryCity} : la remise au destinataire est imminente.` };
    default:
      return null;
  }
}
