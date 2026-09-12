// mobile/src/components/screens/ConversationThreadScreen.tsx
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconArrowLeft, IconSend } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useConversationMessages, useMarkConversationRead, useSendMessage } from '@/hooks/useConversations';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/utils/date';
import type { Message } from '@/types/conversations.types';

export interface ConversationThreadScreenProps {
  conversationId: string;
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  if (message.isSupportIntervention) {
    return (
      <View style={styles.supportRow}>
        <View style={styles.supportBubble}>
          <AppText variant="xs" weight="semibold" color="accentDark" style={styles.supportLabel}>
            Support
          </AppText>
          <AppText variant="sm">{message.content}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <AppText variant="sm" color={isMine ? colors.onPrimary : 'textPrimary'}>
          {message.content}
        </AppText>
      </View>
      <AppText variant="xs" color="textMuted" style={styles.timeLabel}>
        {formatTime(message.sentAt)}
      </AppText>
    </View>
  );
}

/**
 * Interrogation périodique plutôt que temps réel — le backend n'expose
 * aucun canal websocket pour la messagerie (REST uniquement, voir
 * useConversations.ts). Suffisant pour un MVP, à revoir si un vrai
 * besoin de latence faible apparaît.
 */
export function ConversationThreadScreen({ conversationId }: ConversationThreadScreenProps) {
  const [draft, setDraft] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data, isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);

  useFocusEffect(
    useCallback(() => {
      markRead.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]),
  );

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    sendMessage.mutate(content);
  }

  return (
    <ScreenContainer
      maxWidth="detail"
      footer={
        <View style={styles.composer}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire un message…"
            style={styles.composerInput}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            style={[styles.sendButton, (!draft.trim() || sendMessage.isPending) && styles.sendButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
          >
            <IconSend size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Conversation
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading
            ? () => (
                <AppText variant="sm" color="textMuted" style={styles.empty}>
                  Aucun message pour le moment — écrivez le premier.
                </AppText>
              )
            : undefined
        }
        renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === currentUserId} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  list: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  bubbleRow: {
    maxWidth: '78%',
  },
  bubbleRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleRowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: 4,
  },
  timeLabel: {
    marginTop: 2,
    marginHorizontal: 4,
  },
  supportRow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  supportBubble: {
    maxWidth: '85%',
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  supportLabel: {
    marginBottom: 2,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    width: '100%',
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
