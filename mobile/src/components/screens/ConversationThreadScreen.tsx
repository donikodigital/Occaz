// mobile/src/components/screens/ConversationThreadScreen.tsx
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconArrowLeft, IconPackage, IconRoute, IconSend } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useConversation, useConversationMessages, useMarkConversationRead, useSendMessage } from '@/hooks/useConversations';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/utils/date';
import type { ConversationDetail, Message } from '@/types/conversations.types';

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

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Nom du correspondant + contexte (trajet/envoi) à partir du détail — déduit selon si l'utilisateur courant est le client ou le chauffeur de cette conversation. */
function useThreadHeader(detail: ConversationDetail | undefined, currentUserId: string | undefined) {
  if (!detail) return { name: 'Conversation', initials: '…', subtitle: undefined, isShipment: false };

  const iAmCustomer = currentUserId === detail.customer.userId;
  const iAmDriver = currentUserId === detail.driver.userId;
  const correspondent = iAmCustomer
    ? detail.driver
    : iAmDriver
      ? detail.customer
      : null; // vue support : ni client ni chauffeur

  const name = correspondent
    ? `${correspondent.firstName} ${correspondent.lastName}`
    : `${detail.customer.firstName} ${detail.customer.lastName} ↔ ${detail.driver.firstName} ${detail.driver.lastName}`;
  const initials = correspondent ? initialsOf(correspondent.firstName, correspondent.lastName) : '⋯';

  const subtitle = detail.booking
    ? `${detail.booking.trip.originCity.name} → ${detail.booking.trip.destinationCity.name}`
    : detail.shipment
      ? `Envoi pour ${detail.shipment.recipientName}`
      : undefined;

  return { name, initials, subtitle, isShipment: Boolean(detail.shipment) };
}

/**
 * Interrogation périodique plutôt que temps réel — le backend n'expose
 * aucun canal websocket pour la messagerie (REST uniquement, voir
 * useConversations.ts). Suffisant pour un MVP, à revoir si un vrai
 * besoin de latence faible apparaît.
 *
 * NOTE : useConversationMessages ne charge que la première page (30
 * messages) — aucun mécanisme de pagination/chargement des messages
 * plus anciens n'existe encore dans cet écran. Hors du périmètre de
 * cette correction (qui visait le manque de contexte affiché), à
 * traiter séparément si une conversation dépasse 30 messages en usage réel.
 */
export function ConversationThreadScreen({ conversationId }: ConversationThreadScreenProps) {
  const [draft, setDraft] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: detail } = useConversation(conversationId);
  const { data, isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);

  const header = useThreadHeader(detail, currentUserId);

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
        <View style={styles.avatar}>
          <AppText variant="xs" weight="semibold" color="primary">
            {header.initials}
          </AppText>
        </View>
        <View style={styles.headerTextGroup}>
          <AppText variant="md" weight="semibold" numberOfLines={1}>
            {header.name}
          </AppText>
          {header.subtitle ? (
            <View style={styles.subtitleRow}>
              {header.isShipment ? (
                <IconPackage size={12} color={colors.textSecondary} />
              ) : (
                <IconRoute size={12} color={colors.textSecondary} />
              )}
              <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                {header.subtitle}
              </AppText>
            </View>
          ) : null}
        </View>
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
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
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