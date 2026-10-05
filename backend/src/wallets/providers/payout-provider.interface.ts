// backend/src/wallets/providers/payout-provider.interface.ts
//
// Contrat des prestataires qui ENVOIENT de l'argent à un conducteur (Orange Money…), pendant du contrat des paiements encaissés
// (payments/providers/payment-provider-adapter.interface.ts). Aucun module métier ne parle à un SDK de prestataire : seulement
// PayoutsService, qui délègue à l'adaptateur choisi par PayoutProviderRegistry.
//
// Pour brancher le vrai Orange Money : écrire une classe qui implémente PayoutProvider (un appel de virement vers le numéro de
// destination, avec `reference` comme clé d'idempotence), l'enregistrer dans PayoutProviderRegistry, puis définir
// PAYOUT_PROVIDER=orange_money. Rien d'autre à changer.

export interface DisburseParams {
  /** Identifiant du retrait : sert de clé d'idempotence chez le prestataire (un même retrait ne part jamais deux fois). */
  reference: string;
  /** Montant, plus petite unité de la devise. */
  amount: bigint;
  currencyIsoCode: string;
  /** Mode choisi par le conducteur (« orange_money », « mobile_money »…). */
  method: string;
  /** Numéro Mobile Money du conducteur, format international. */
  destination: string;
}

export type DisburseOutcome =
  /** Argent parti : le retrait est payé. */
  | { status: 'PAID'; externalReference: string }
  /** Virement accepté mais pas encore confirmé (prestataire asynchrone) : le retrait reste « en cours ». */
  | { status: 'PROCESSING'; externalReference: string }
  /** Refus définitif (numéro invalide, compte plafonné…) : aucun argent n'est parti, le solde est remis au conducteur. */
  | { status: 'FAILED'; reason: string; externalReference?: string };

export interface PayoutProvider {
  /** Vrai pour une simulation : aucun argent réel ne bouge. Sert aux avertissements de sécurité. */
  readonly isSimulated: boolean;

  /**
   * Envoie le virement. Doit renvoyer un résultat explicite (PAID / PROCESSING / FAILED). Une exception signifie « résultat
   * inconnu » (réseau coupé, délai dépassé) : l'argent a peut-être été envoyé, le retrait reste alors « en cours » pour
   * vérification par l'équipe, jamais remboursé automatiquement.
   */
  disburse(params: DisburseParams): Promise<DisburseOutcome>;
}

export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');
