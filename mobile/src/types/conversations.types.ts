// mobile/src/types/conversations.types.ts
export interface ConversationSummary {
  id: string;
  bookingId: string | null;
  shipmentId: string | null;
  customerId: string;
  driverId: string;
  createdAt: string;
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
