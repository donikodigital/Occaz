// backend/src/i18n/texts/texts-shipments.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_SHIPMENTS: readonly TextRow[] = [
  ["Communiquez ce code au conducteur pour confirmer la remise du colis :", "Give this code to the driver to confirm the parcel handover:", "Comunique este código ao condutor para confirmar a entrega da encomenda:"],
  ["Communiquez ce code au conducteur pour confirmer la réception du colis :", "Give this code to the driver to confirm receipt of the parcel:", "Comunique este código ao condutor para confirmar a receção da encomenda:"],
  ["L'état de cet envoi a changé : actualisez l'écran.", "The status of this shipment has changed: please refresh the screen.", "O estado deste envio mudou: atualize o ecrã."],
  ["Adresse précisée après acceptation", "Address provided after acceptance", "Morada indicada após aceitação"],
  ["Aucun conducteur avant la fin de la période et pas de prolongation — remboursement intégral.", "No driver before the end of the period and no extension — full refund.", "Nenhum condutor antes do fim do período e sem prolongamento — reembolso integral."],
  ["Paiement non effectué dans le délai imparti.", "Payment not made within the allotted time.", "Pagamento não efetuado dentro do prazo."],
  ["Plage prolongée jusqu'au {0}", "Period extended until {0}", "Período prolongado até {0}"],
  ["un colis", "a parcel", "uma encomenda"],
  ["un courrier", "a letter", "uma carta"],
  ["votre colis", "your parcel", "a sua encomenda"],
  ["Lieu de départ", "Departure point", "Local de partida"],
  ["Lieu de livraison", "Delivery point", "Local de entrega"],
  ["Le conducteur", "The driver", "O condutor"],
  ["Client", "Customer", "Cliente"],
  ["client", "customer", "cliente"],
  ["Conducteur", "Driver", "Condutor"],
  ["conducteur", "driver", "condutor"],
];
