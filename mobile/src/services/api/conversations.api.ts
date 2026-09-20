// mobile/src/services/api/conversations.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { ConversationDetail, ConversationSummary, Message } from '@/types/conversations.types';

export const conversationsApi = {
  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<ConversationSummary>>('/conversations/mine', { query: params }),

  getOne: (id: string) => api.get<ConversationDetail>(`/conversations/${id}`),

  getOrCreateForBooking: (bookingId: string) =>
    api.post<ConversationSummary>(`/conversations/booking/${bookingId}`),

  getOrCreateForShipment: (shipmentId: string) =>
    api.post<ConversationSummary>(`/conversations/shipment/${shipmentId}`),

  listMessages: (conversationId: string, params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Message>>(`/conversations/${conversationId}/messages`, { query: params }),

  sendMessage: (conversationId: string, content: string) =>
    api.post<Message>(`/conversations/${conversationId}/messages`, { content }),

  markRead: (conversationId: string) => api.patch<void>(`/conversations/${conversationId}/read`),
};