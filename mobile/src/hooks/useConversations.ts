// mobile/src/hooks/useConversations.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/services/api/conversations.api';

export function useMyConversations(page = 1) {
  return useQuery({
    queryKey: ['conversations', 'mine', page],
    queryFn: () => conversationsApi.listMine({ page, limit: 20 }),
  });
}

/** Détail (correspondant + contexte trajet/envoi) — voir ConversationDetail. Absent avant l'ajout de GET /conversations/:id. */
export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'detail'],
    queryFn: () => conversationsApi.getOne(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useConversationMessages(conversationId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages', page],
    queryFn: () => conversationsApi.listMessages(conversationId!, { page, limit: 30 }),
    enabled: Boolean(conversationId),
    refetchInterval: 10_000,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => conversationsApi.sendMessage(conversationId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'mine'] });
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => conversationsApi.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'mine'] });
    },
  });
}

export function useGetOrCreateConversationForBooking() {
  return useMutation({ mutationFn: (bookingId: string) => conversationsApi.getOrCreateForBooking(bookingId) });
}

export function useGetOrCreateConversationForShipment() {
  return useMutation({ mutationFn: (shipmentId: string) => conversationsApi.getOrCreateForShipment(shipmentId) });
}