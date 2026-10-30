// backend/src/i18n/texts/errors-tickets.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_TICKETS: readonly TextRow[] = [
  ["Variable d'environnement TICKET_SIGNING_SECRET manquante (ou JWT_ACCESS_SECRET) — voir .env.example.", "The TICKET_SIGNING_SECRET environment variable is missing (or JWT_ACCESS_SECRET) — see .env.example.", "Falta a variável de ambiente TICKET_SIGNING_SECRET (ou JWT_ACCESS_SECRET) — consulte .env.example."],
  ["Seuls les conducteurs peuvent scanner un billet.", "Only drivers can scan a ticket.", "Só os condutores podem ler um bilhete."],
  ["Lien invalide ou expiré. Demandez-en un nouveau depuis l'application.", "Invalid or expired link. Request a new one from the app.", "Ligação inválida ou expirada. Peça uma nova na aplicação."],
  ["Le billet est disponible une fois la réservation payée (et tant qu'elle n'est pas annulée).", "The ticket is available once the booking is paid (and as long as it is not cancelled).", "O bilhete fica disponível quando a reserva estiver paga (e enquanto não for cancelada)."],
  ["Les étiquettes sont disponibles une fois l'envoi payé (et tant qu'il n'est pas annulé).", "The labels are available once the shipment is paid (and as long as it is not cancelled).", "As etiquetas ficam disponíveis quando o envio estiver pago (e enquanto não for cancelado)."],
];
