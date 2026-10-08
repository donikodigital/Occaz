// mobile/src/components/screens/ConversationThreadScreen.tsx
//
// [08/10/2026] v3 — (1) l'en-tête devient un bandeau (hero) bleu océan : bouton retour, avatar, NOM du correspondant, son RÔLE (« Votre
// conducteur », « Votre passager », « Expéditeur du colis ») et une pastille de contexte lisible (« Réservation · Lélouma → Conakry »,
// « Votre colis pour Mariama ») au lieu de « nom + ville → ville » sans libellé ; (2) « Aucun message pour le moment » n'est plus le
// composant « liste vide » d'une liste inversée (qui s'affichait à l'envers sur Android) : c'est un texte posé hors de la liste ;
// (3) le clavier ne masque plus la zone de saisie — voir ScreenContainer (KeyboardAvoidingView actif sur Android aussi).
// v2 — Habillage bleu océan (partagé client / conducteur) : en-tête avec
// bouton de retour rond, avatar aux initiales et contexte (trajet ou envoi),
// bulles bleues pour soi et claires pour l'autre, message du support en
// doré, zone de saisie arrondie avec un bouton d'envoi bleu. Logique
// inchangée.
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconArrowLeft, IconPackage, IconRoute, IconSend } from '@tabler/icons-react-native';
import { OceanHeroCard } from '@/components/ocean/OceanKit';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
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
          <AppText variant="xs" weight="bold" color={OCEAN.goldInk} style={styles.supportLabel}>
            SUPPORT
          </AppText>
          <AppText variant="sm">{message.content}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <AppText variant="sm" color={isMine ? OCEAN.onDark : 'textPrimary'}>
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

/**
 * Nom du correspondant, son rôle et le contexte de la conversation (réservation ou colis), déduits du détail selon que l'utilisateur
 * courant est le client ou le conducteur de cette conversation.
 */
function useThreadHeader(detail: ConversationDetail | undefined, currentUserId: string | undefined) {
  if (!detail) return { name: 'Conversation', initials: '…', role: undefined, context: undefined, isShipment: false };

  const iAmCustomer = currentUserId === detail.customer.userId;
  const iAmDriver = currentUserId === detail.driver.userId;
  const correspondent = iAmCustomer
    ? detail.driver
    : iAmDriver
      ? detail.customer
      : null; // vue support : ni client ni conducteur

  const name = correspondent
    ? `${correspondent.firstName} ${correspondent.lastName}`
    : `${detail.customer.firstName} ${detail.customer.lastName} ↔ ${detail.driver.firstName} ${detail.driver.lastName}`;
  const initials = correspondent ? initialsOf(correspondent.firstName, correspondent.lastName) : '⋯';

  let role: string;
  if (iAmCustomer) role = 'Votre conducteur';
  else if (iAmDriver) role = detail.shipment ? 'Expéditeur du colis' : 'Votre passager';
  else role = 'Client et conducteur';

  let context: string | undefined;
  if (detail.booking) {
    context = `Réservation · ${detail.booking.trip.originCity.name} → ${detail.booking.trip.destinationCity.name}`;
  } else if (detail.shipment) {
    context = iAmCustomer
      ? `Votre colis pour ${detail.shipment.recipientName}`
      : `Colis de ${detail.shipment.senderName} pour ${detail.shipment.recipientName}`;
  }

  return { name, initials, role, context, isShipment: Boolean(detail.shipment) };
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
 *
 * NOTE : la liste utilise `inverted`. Les cellules (bulles) sont retournées par React Native pour rester à l'endroit, mais pas
 * le composant `ListEmptyComponent`, qui s'affichait à l'envers sur Android : le message « aucun message » est donc rendu hors de
 * la liste (voir plus bas), jamais comme composant « liste vide ».
 */
export function ConversationThreadScreen({ conversationId }: ConversationThreadScreenProps) {
  const [draft, setDraft] = useState('');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: detail } = useConversation(conversationId);
  const { data, isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);

  const header = useThreadHeader(detail, currentUserId);
  const messages = data?.data ?? [];
  const canSend = Boolean(draft.trim()) && !sendMessage.isPending;

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
            containerStyle={styles.composerInput}
            style={styles.composerInputText}
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
      }
    >
      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <IconArrowLeft size={18} color={OCEAN.onDark} />
          </Pressable>
          <View style={styles.avatar}>
            <AppText variant="md" weight="bold" color={OCEAN.onDark}>
              {header.initials}
            </AppText>
          </View>
          <View style={styles.headerTextGroup}>
            <AppText variant="lg" weight="bold" color={OCEAN.onDark} numberOfLines={1}>
              {header.name}
            </AppText>
            {header.role ? (
              <AppText variant="xs" color={OCEAN.sky} numberOfLines={1}>
                {header.role}
              </AppText>
            ) : null}
          </View>
        </View>
        {header.context ? (
          <View style={styles.contextPill}>
            {header.isShipment ? (
              <IconPackage size={14} color={OCEAN.gold} />
            ) : (
              <IconRoute size={14} color={OCEAN.gold} />
            )}
            <AppText variant="xs" weight="semibold" color={OCEAN.onDark} numberOfLines={2} style={styles.contextText}>
              {header.context}
            </AppText>
          </View>
        ) : null}
      </OceanHeroCard>

      {messages.length === 0 && !isLoading ? (
        <View style={styles.emptyWrap}>
          <AppText variant="sm" color="textMuted" style={styles.empty}>
            Aucun message pour le moment — écrivez le premier.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === currentUserId} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  hero: {
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OCEAN.bright,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  contextText: {
    flexShrink: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 1,
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
  supportRow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  supportBubble: {
    maxWidth: '85%',
    backgroundColor: OCEAN.goldSoft,
    borderRadius: 16,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
  },
  supportLabel: {
    letterSpacing: 0.8,
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