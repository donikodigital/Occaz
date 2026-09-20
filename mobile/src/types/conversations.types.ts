// mobile/src/types/conversations.types.ts
export interface ConversationSummary {
  id: string;
  bookingId: string | null;
  shipmentId: string | null;
  customerId: string;
  driverId: string;
  createdAt: string;
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