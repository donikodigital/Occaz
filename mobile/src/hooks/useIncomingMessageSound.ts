// mobile/src/hooks/useIncomingMessageSound.ts
import { useEffect, useRef } from 'react';
import { playMessageSound } from '@/utils/messageSound';
import type { Message } from '@/types/conversations.types';

/**
 * Joue le son des messages quand un message de l'AUTRE personne apparaît dans la conversation ouverte. Les messages déjà là à
 * l'ouverture ne sonnent pas (on n'annonce que ce qui arrive) ; les siens non plus.
 */
export function useIncomingMessageSound(
  conversationId: string,
  messages: Message[] | undefined,
  currentUserId: string | undefined,
): void {
  const seen = useRef<Set<string>>(new Set());
  const ready = useRef(false);
  const lastConversation = useRef(conversationId);

  useEffect(() => {
    if (lastConversation.current !== conversationId) {
      lastConversation.current = conversationId;
      seen.current = new Set();
      ready.current = false;
    }
    if (!messages) return;

    const fresh = messages.filter((message) => !seen.current.has(message.id));
    for (const message of messages) seen.current.add(message.id);

    if (!ready.current) {
      ready.current = true; // premier chargement : état de départ, rien à annoncer
      return;
    }
    if (fresh.some((message) => message.senderId !== currentUserId)) void playMessageSound();
  }, [conversationId, messages, currentUserId]);
}
