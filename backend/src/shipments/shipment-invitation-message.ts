// backend/src/shipments/shipment-invitation-message.ts
// [09/10/2026] v1 — texte de l'invitation envoyée par un client à un conducteur (push, e-mail et écran du conducteur).

const LETTER_CATEGORY = /courrier|document|lettre|enveloppe|\bpli\b/i;

export interface InvitationMessageInput {
  driverFirstName: string;
  driverLastName: string;
  /** Catégorie de l'envoi : « Courrier », « Documents »… → « un courrier » ; sinon « un colis ». */
  categoryName: string;
  /** Ville où le colis doit arriver. */
  destinationCity: string;
}

export function invitationSubject(input: Pick<InvitationMessageInput, 'destinationCity'>): string {
  return `Un colis à transporter vers ${input.destinationCity}`;
}

/**
 * Le message que le client « écrit » au conducteur. Ne contient aucune donnée personnelle du client (ni nom, ni numéro, ni adresse) :
 * ses coordonnées ne sont communiquées qu'une fois l'envoi accepté.
 */
export function buildInvitationMessage(input: InvitationMessageInput): string {
  const thing = LETTER_CATEGORY.test(input.categoryName) ? 'un courrier' : 'un colis';
  const name = `${input.driverFirstName} ${input.driverLastName}`.trim();
  return [
    `Bonjour ${name},`,
    `J'ai préparé ${thing} à envoyer à destination de ${input.destinationCity}. J'ai vu que vous deviez effectuer ce trajet. Pourriez-vous l'accepter, s'il vous plaît ?`,
    'Je vous remercie d’avance.',
  ].join('\n\n');
}
