// mobile/src/components/screens/DisputeDetailScreen.tsx
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconSend } from '@tabler/icons-react-native';
import { AppText, Badge, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useAddDisputeMessage, useDispute } from '@/hooks/useDisputes';
import { useAuthStore } from '@/stores/authStore';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS, DISPUTE_STATUS_TONE } from '@/utils/disputeLabels';
import { formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import type { DisputeMessage } from '@/types/disputes.types';

export interface DisputeDetailScreenProps {
  disputeId: string;
}

function DisputeMessageBubble({
  message,
  isMine,
  isFromAgent,
}: {
  message: DisputeMessage;
  isMine: boolean;
  isFromAgent: boolean;
}) {
  if (isFromAgent && !isMine) {
    return (
      <View style={styles.agentRow}>
        <View style={styles.agentBubble}>
          <AppText variant="xs" weight="semibold" color="accentDark" style={styles.agentLabel}>
            Support
          </AppText>
          <AppText variant="sm">{message.message}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <AppText variant="sm" color={isMine ? colors.onPrimary : 'textPrimary'}>
          {message.message}
        </AppText>
      </View>
      <AppText variant="xs" color="textMuted" style={styles.timeLabel}>
        {formatTime(message.createdAt)}
      </AppText>
    </View>
  );
}

/** Interrogation périodique (15s) — même limite backend que la messagerie du Lot 7 (aucun canal temps réel). */
export function DisputeDetailScreen({ disputeId }: DisputeDetailScreenProps) {
  const [draft, setDraft] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: dispute, isLoading, isError } = useDispute(disputeId);
  const addMessage = useAddDisputeMessage(disputeId);

  if (isLoading || !dispute) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger ce litige.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </ScreenContainer>
    );
  }

  const messages = [...(dispute.messages ?? [])].reverse();
  const canReply = dispute.status !== 'CLOSED';

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    addMessage.mutate(content);
  }

  return (
    <ScreenContainer
      maxWidth="detail"
      footer={
        canReply ? (
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
              disabled={!draft.trim() || addMessage.isPending}
              style={[styles.sendButton, (!draft.trim() || addMessage.isPending) && styles.sendButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
            >
              <IconSend size={18} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {dispute.reason}
        </AppText>
      </View>

      <View style={styles.badgeRow}>
        <Badge label={DISPUTE_STATUS_LABELS[dispute.status]} tone={DISPUTE_STATUS_TONE[dispute.status]} />
        <Badge label={DISPUTE_PRIORITY_LABELS[dispute.priority]} tone="neutral" />
      </View>

      {dispute.description ? (
        <AppText variant="sm" color="textSecondary" style={styles.description}>
          {dispute.description}
        </AppText>
      ) : null}

      {dispute.resolution ? (
        <View style={styles.resolutionCard}>
          <AppText variant="sm" weight="semibold" color="successDark">
            Litige résolu
          </AppText>
          {dispute.resolution.refundAmount ? (
            <AppText variant="xs" color="textSecondary">
              Remboursement : {formatMoney(dispute.resolution.refundAmount)}
            </AppText>
          ) : null}
          {dispute.resolution.notes ? (
            <AppText variant="xs" color="textSecondary">
              {dispute.resolution.notes}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <AppText variant="sm" color="textMuted" style={styles.empty}>
            Aucun message pour le moment.
          </AppText>
        }
        renderItem={({ item }) => (
          <DisputeMessageBubble
            message={item}
            isMine={item.authorId === currentUserId}
            isFromAgent={Boolean(dispute.assignedAgentId) && item.authorId === dispute.assignedAgentId}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  description: {
    marginBottom: spacing.md,
  },
  resolutionCard: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 2,
    marginBottom: spacing.md,
  },
  list: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
  agentRow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  agentBubble: {
    maxWidth: '85%',
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  agentLabel: {
    marginBottom: 2,
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
