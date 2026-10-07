// mobile/src/types/conversations.types.ts
/** Villes de départ et d'arrivée d'un trajet, pour afficher « Conakry → Dakar ». */
export interface TripCities {
  originCity: { name: string };
  destinationCity: { name: string };
}

export interface ConversationSummary {
  id: string;
  bookingId: string | null;
  shipmentId: string | null;
  customerId: string;
  driverId: string;
  createdAt: string;

  // Ajoutés à GET /conversations/mine pour l'écran « Messages » — facultatifs : un serveur plus ancien ne les renvoie pas, et
  // l'écran retombe alors sur un affichage sobre (type + heure).
  /** Prénom et nom de l'autre personne (le client pour un conducteur, le conducteur pour un client). */
  counterpart?: { firstName: string; lastName: string };
  /** Dernier message ; `fromMe` : écrit par l'utilisateur lui-même. Null tant que personne n'a écrit. */
  lastMessage?: { content: string; sentAt: string; fromMe: boolean; isSupportIntervention: boolean } | null;
  /** Messages de l'autre partie pas encore lus. */
  unreadCount?: number;
  booking?: { trip?: TripCities | null } | null;
  shipment?: { senderName: string; recipientName: string; trip?: TripCities | null } | null;
}

/** Réponse de GET /conversations/:id — uniquement prénom/nom des deux parties (jamais mobileMoneyNumber, adresse... voir ConversationsService.findOne côté backend). */
export interface ConversationDetail {
  id: string;
  bookingId: string | null;
  shipmentId: string | null;
  createdAt: string;
  customer: { id: string; userId: string; firstName: string; lastName: string };
  driver: { id: string; userId: string; firstName: string; lastName: string };
  booking: {
    id: string;
    trip: { originCity: { name: string }; destinationCity: { name: string } };
  } | null;
  shipment: { id: string; senderName: string; recipientName: string } | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; phone: string };
  content: string;
  isSupportIntervention: boolean;
  readAt: string | null;
  sentAt: string;
}