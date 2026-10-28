// mobile/src/components/screens/DisputeDetailScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// v2 — Habillage bleu océan (partagé client / conducteur) : en-tête avec
// retour rond, pastilles de statut et de priorité, carte verte « Litige
// résolu », fil de messages aux bulles bleues (soi) et claires (l'autre),
// message du support en doré, saisie arrondie avec bouton d'envoi bleu.
// Logique inchangée.
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCircleCheck, IconLifebuoy, IconSend } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAddDisputeMessage, useDispute } from '@/hooks/useDisputes';
import { useAuthStore } from '@/stores/authStore';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS, DISPUTE_STATUS_TONE } from '@/utils/disputeLabels';
import { formatTime } from '@/utils/date';
import { currencyOf, formatMoney } from '@/utils/money';
import type { DisputeMessage } from '@/types/disputes.types';
import { useT, translate } from '@/i18n';

export interface DisputeDetailScreenProps {
  /** Page affichée juste après la création du signalement : remplace la flèche « Retour » par une croix qui ferme tout le parcours. */
  onClose?: () => void;
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
            {translate('Support').toUpperCase()}
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

/**
 * Interrogation périodique (15s) — même limite backend que la messagerie du Lot 7 (aucun canal temps réel).
 *
 * NOTE : la liste utilise `inverted`. Les bulles sont retournées par React Native pour rester à l'endroit, mais pas
 * `ListEmptyComponent`, qui s'affichait à l'envers sur Android : « Aucun message » est donc rendu hors de la liste.
 */
export function DisputeDetailScreen({ disputeId, onClose }: DisputeDetailScreenProps) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: dispute, isLoading, isError } = useDispute(disputeId);
  const addMessage = useAddDisputeMessage(disputeId);

  if (isLoading || !dispute) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            {t('Impossible de charger ce litige.')}
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
              placeholder={t('Écrire un message…')}
              containerStyle={styles.composerInput}
              style={styles.composerInputText}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('Envoyer')}
            >
              <IconSend size={18} color={OCEAN.onDark} />
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <OceanHeroHeader
        title={dispute.reason}
        subtitle={t('Signalement')}
        icon={<IconLifebuoy />}
        // Page affichée juste après la création du signalement : une croix qui revient à l'accueil, pas la flèche vers le
        // formulaire et les écrans d'avant.
        onBack={() => router.back()}
        onClose={onClose}
      />

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
              {t('Litige résolu')}
            </AppText>
          </View>
          {dispute.resolution.refundAmount ? (
            <AppText variant="xs" color="textSecondary">
              {t('Remboursement : {money}', { money: formatMoney(dispute.resolution.refundAmount, currencyOf(dispute.booking) ?? currencyOf(dispute.shipment)) })}
            </AppText>
          ) : null}
          {dispute.resolution.notes ? (
            <AppText variant="xs" color="textSecondary">
              {dispute.resolution.notes}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppText variant="sm" color="textMuted" style={styles.empty}>
            {t('Aucun message pour le moment.')}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <DisputeMessageBubble
              message={item}
              isMine={item.authorId === currentUserId}
              isFromAgent={Boolean(dispute.assignedAgentId) && item.authorId === dispute.assignedAgentId}
            />
          )}
        />
      )}
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
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
  },
  composerInputText: {
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
