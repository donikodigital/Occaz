// mobile/src/components/screens/DisputeDetailScreen.tsx
//
// v2 — Habillage bleu océan (partagé client / chauffeur) : en-tête avec
// retour rond, pastilles de statut et de priorité, carte verte « Litige
// résolu », fil de messages aux bulles bleues (soi) et claires (l'autre),
// message du support en doré, saisie arrondie avec bouton d'envoi bleu.
// Logique inchangée.
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconCircleCheck, IconSend } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAddDisputeMessage, useDispute } from '@/hooks/useDisputes';
import { useAuthStore } from '@/stores/authStore';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS, DISPUTE_STATUS_TONE } from '@/utils/disputeLabels';
import { formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import type { DisputeMessage } from '@/types/disputes.types';

export interface DisputeDetailScreenProps {
  disputeId: string;
}

function pillToneFor(tone: string): OceanPillTone {
  if (tone === 'success') return 'success';
  if (tone === 'danger') return 'danger';
  if (tone === 'neutral') return 'neutral';
  return 'ocean';
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
          <AppText variant="xs" weight="bold" color={OCEAN.goldInk} style={styles.agentLabel}>
            SUPPORT
          </AppText>
          <AppText variant="sm">{message.message}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <AppText variant="sm" color={isMine ? OCEAN.onDark : 'textPrimary'}>
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
          <ActivityIndicator color={OCEAN.base} />
        )}
      </ScreenContainer>
    );
  }

  const messages = [...(dispute.messages ?? [])].reverse();
  const canReply = dispute.status !== 'CLOSED';
  const canSend = Boolean(draft.trim()) && !addMessage.isPending;

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
              disabled={!canSend}
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
            >
              <IconSend size={18} color={OCEAN.onDark} />
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <IconArrowLeft size={18} color={OCEAN.base} />
        </Pressable>
        <AppText variant="lg" weight="bold" color={OCEAN.deep} numberOfLines={2} style={styles.title}>
          {dispute.reason}
        </AppText>
      </View>

      <View style={styles.badgeRow}>
        <OceanPill label={DISPUTE_STATUS_LABELS[dispute.status]} tone={pillToneFor(DISPUTE_STATUS_TONE[dispute.status])} />
        <OceanPill label={DISPUTE_PRIORITY_LABELS[dispute.priority]} tone="neutral" />
      </View>

      {dispute.description ? (
        <AppText variant="sm" color="textSecondary" style={styles.description}>
          {dispute.description}
        </AppText>
      ) : null}

      {dispute.resolution ? (
        <View style={styles.resolutionCard}>
          <View style={styles.resolutionTitle}>
            <IconCircleCheck size={18} color={colors.successDark} />
            <AppText variant="sm" weight="bold" color="successDark">
              Litige résolu
            </AppText>
          </View>
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
  pressed: {
    opacity: 0.75,
  },
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  description: {
    marginBottom: spacing.md,
  },
  resolutionCard: {
    backgroundColor: colors.successLight,
    borderRadius: 18,
    padding: spacing.md,
    gap: 4,
    marginBottom: spacing.md,
  },
  resolutionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    borderRadius: 20,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.sm + 4,
  },
  bubbleMine: {
    backgroundColor: OCEAN.base,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: OCEAN.mist,
    borderWidth: 1,
    borderColor: OCEAN.line,
    borderBottomLeftRadius: 6,
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
    backgroundColor: OCEAN.goldSoft,
    borderRadius: 16,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
  },
  agentLabel: {
    letterSpacing: 0.8,
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
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});