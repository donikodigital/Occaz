// mobile/src/components/screens/ConversationsListScreen.tsx
//
// v3 — Écran « Messages » modernisé (partagé client / conducteur) :
//   - un bandeau (hero) bleu océan avec le titre « Mes conversations », une phrase adaptée au rôle et deux compteurs
//     (conversations, non lus) ;
//   - des cartes qui disent de quoi on parle au lieu de « Trajet » / « Envoi » tout court : l'itinéraire (« Conakry → Dakar »)
//     ou le destinataire du colis, l'autre personne (Conducteur · Prénom Nom, Passager · …), l'aperçu du dernier message
//     (« Vous : … »), l'heure d'activité et une pastille de messages non lus ;
//   - triées par dernière activité, regroupées par jour.
//   Les informations viennent de GET /conversations/mine (champs ajoutés : counterpart, lastMessage, unreadCount, villes). Si le
//   serveur est plus ancien et ne les renvoie pas, chaque carte retombe sur un affichage sobre (type + heure), comme avant.
//
// v2 — Habillage bleu océan (partagé client / conducteur) : titre avec sous-titre, cartes ombrées avec une pastille de couleur
// par type (bleu pour un trajet, doré pour un envoi), et un état vide qui explique quand une conversation apparaît.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMessageCircle, IconMessages, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanHeroCard, OceanPill } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyConversations } from '@/hooks/useConversations';
import { formatDateShort, formatTime } from '@/utils/date';
import type { ConversationSummary, TripCities } from '@/types/conversations.types';

export interface ConversationsListScreenProps {
  /** Racine de navigation du groupe appelant — (customer) et (driver) sont deux Stacks Expo Router isolés. */
  basePath: '/(customer)' | '/(driver)';
}

type ListRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; key: string; conversation: ConversationSummary };

const DAY_MS = 86_400_000;

/** Dernière activité : le dernier message, ou la création de la conversation tant que personne n'a écrit. */
function activityAt(conversation: ConversationSummary): string {
  return conversation.lastMessage?.sentAt ?? conversation.createdAt;
}

function daysAgo(dateIso: string, now: Date): number {
  const date = new Date(dateIso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfItemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfToday.getTime() - startOfItemDay.getTime()) / DAY_MS);
}

function sectionLabelFor(dateIso: string, now: Date): string {
  const diffDays = daysAgo(dateIso, now);
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return 'Cette semaine';
  return 'Plus tôt';
}

/** Heure aujourd'hui, « Hier », le jour de la semaine cette semaine, sinon la date courte. */
function formatActivity(dateIso: string, now: Date): string {
  const diffDays = daysAgo(dateIso, now);
  if (diffDays <= 0) return formatTime(dateIso);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(dateIso));
  return formatDateShort(dateIso);
}

function routeOf(trip: TripCities | null | undefined): string | null {
  const origin = trip?.originCity?.name;
  const destination = trip?.destinationCity?.name;
  return origin && destination ? `${origin} → ${destination}` : null;
}

/** Ce dont parle la conversation : l'itinéraire du trajet, ou le colis et son destinataire. */
function conversationTitle(conversation: ConversationSummary): string {
  if (conversation.shipmentId) {
    const recipient = conversation.shipment?.recipientName?.trim();
    return recipient ? `Colis pour ${recipient}` : 'Envoi de colis';
  }
  return routeOf(conversation.booking?.trip) ?? 'Trajet partagé';
}

/** « Conducteur · Moustapha Diallo » côté client ; « Passager · … » (trajet) ou « Client · … » (colis) côté conducteur. */
function counterpartLine(conversation: ConversationSummary, isDriver: boolean): string | null {
  const person = conversation.counterpart;
  const name = person ? `${person.firstName} ${person.lastName}`.trim() : '';
  if (!name) return null;
  const role = !isDriver ? 'Conducteur' : conversation.shipmentId ? 'Client' : 'Passager';
  return `${role} · ${name}`;
}

function previewOf(conversation: ConversationSummary): { text: string; empty: boolean } {
  const last = conversation.lastMessage;
  if (!last) return { text: "Aucun message pour l'instant. Écrivez le premier !", empty: true };
  const prefix = last.isSupportIntervention ? "Support Occa'Z : " : last.fromMe ? 'Vous : ' : '';
  return { text: `${prefix}${last.content.replace(/\s+/g, ' ').trim()}`, empty: false };
}

function ConversationRow({
  conversation,
  basePath,
  now,
}: {
  conversation: ConversationSummary;
  basePath: string;
  now: Date;
}) {
  const isShipment = Boolean(conversation.shipmentId);
  const isDriver = basePath === '/(driver)';
  const unread = conversation.unreadCount ?? 0;
  const title = conversationTitle(conversation);
  const person = counterpartLine(conversation, isDriver);
  const preview = previewOf(conversation);

  return (
    <OceanCard
      onPress={() => router.push(`${basePath}/conversation/${conversation.id}`)}
      style={styles.row}
      accessibilityLabel={`${title}${person ? `, ${person}` : ''}${unread > 0 ? `, ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : ''}`}
    >
      <View style={[styles.rowIcon, isShipment && styles.rowIconShipment]}>
        {isShipment ? <IconPackage size={22} color={OCEAN.goldInk} /> : <IconRoute size={22} color={OCEAN.base} />}
      </View>

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <AppText variant="sm" weight={unread > 0 ? 'bold' : 'semibold'} numberOfLines={1} style={styles.rowTitle}>
            {title}
          </AppText>
          <AppText variant="xs" weight={unread > 0 ? 'semibold' : 'regular'} color={unread > 0 ? OCEAN.base : 'textMuted'}>
            {formatActivity(activityAt(conversation), now)}
          </AppText>
        </View>

        <View style={styles.rowTop}>
          <AppText
            variant="xs"
            weight={unread > 0 ? 'semibold' : 'regular'}
            color={preview.empty ? 'textMuted' : unread > 0 ? 'textPrimary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.rowTitle}
          >
            {preview.text}
          </AppText>
          {unread > 0 ? (
            <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <AppText variant="xs" weight="bold" color={OCEAN.onDark}>
                {unread > 99 ? '99+' : unread}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.rowMeta}>
          <OceanPill label={isShipment ? 'Colis' : 'Trajet'} tone={isShipment ? 'gold' : 'ocean'} />
          {person ? (
            <AppText variant="xs" color="textMuted" numberOfLines={1} style={styles.rowTitle}>
              {person}
            </AppText>
          ) : null}
        </View>
      </View>
    </OceanCard>
  );
}

/** Bandeau de l'écran : titre, phrase adaptée au rôle et deux compteurs (conversations, non lus). */
function MessagesHero({ isDriver, total, unread }: { isDriver: boolean; total?: number; unread?: number }) {
  return (
    <OceanHeroCard style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <IconMessages size={28} color={OCEAN.onDark} />
        </View>
        <View style={styles.heroTitles}>
          <AppText variant="lg" weight="bold" color={OCEAN.onDark}>
            Mes conversations
          </AppText>
          <AppText variant="xs" color={OCEAN.sky}>
            {isDriver
              ? 'Échangez avec vos passagers et les clients qui vous confient un colis.'
              : 'Échangez avec votre conducteur à propos de vos trajets et de vos colis.'}
          </AppText>
        </View>
      </View>

      {total !== undefined ? (
        <View style={styles.heroStats}>
          <View style={styles.statPill}>
            <AppText variant="xs" weight="semibold" color={OCEAN.onDark}>
              {total} conversation{total > 1 ? 's' : ''}
            </AppText>
          </View>
          <View style={[styles.statPill, unread ? styles.statPillAlert : null]}>
            <AppText variant="xs" weight="semibold" color={unread ? OCEAN.goldInk : OCEAN.onDark}>
              {unread ? `${unread} non lu${unread > 1 ? 's' : ''}` : 'Tout est lu'}
            </AppText>
          </View>
        </View>
      ) : null}
    </OceanHeroCard>
  );
}

/**
 * La liste vient de GET /conversations/mine : une ligne par conversation, avec l'autre personne, le dernier message, les
 * non lus et l'itinéraire. Elle est triée ici par dernière activité (le serveur pagine par date de création), puis regroupée
 * par jour comme NotificationsInboxScreen.
 */
export function ConversationsListScreen({ basePath }: ConversationsListScreenProps) {
  const { data, isLoading } = useMyConversations();
  const isDriver = basePath === '/(driver)';
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(
    () =>
      [...(data?.data ?? [])].sort(
        (a, b) => new Date(activityAt(b)).getTime() - new Date(activityAt(a)).getTime(),
      ),
    [data],
  );

  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    let lastLabel: string | null = null;
    for (const conversation of items) {
      const label = sectionLabelFor(activityAt(conversation), now);
      if (label !== lastLabel) {
        out.push({ kind: 'header', key: `header-${label}`, label });
        lastLabel = label;
      }
      out.push({ kind: 'item', key: conversation.id, conversation });
    }
    return out;
  }, [items, now]);

  const unread = items.reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0);
  const header = (
    <View style={styles.header}>
      <MessagesHero isDriver={isDriver} total={data ? (data.meta?.total ?? items.length) : undefined} unread={unread} />
    </View>
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <ResponsiveList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs + 2 }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconMessageCircle size={28} color={OCEAN.base} />}
              title="Aucune conversation pour l'instant"
              text={
                isDriver
                  ? "Dès qu'un passager réserve un de vos trajets ou qu'un colis vous est confié, la conversation s'ouvre ici."
                  : "Dès que vous réservez un trajet ou qu'un conducteur prend votre colis, la conversation s'ouvre ici."
              }
            />
          ) : undefined
        }
        renderItem={({ item }: { item: ListRow }) =>
          item.kind === 'header' ? (
            <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.sectionLabel}>
              {item.label}
            </AppText>
          ) : (
            <ConversationRow conversation={item.conversation} basePath={basePath} now={now} />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },

  // Bandeau
  hero: {
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTitles: {
    flex: 1,
    gap: 2,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  statPillAlert: {
    backgroundColor: OCEAN.gold,
  },

  // Cartes
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.sm + 4,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconShipment: {
    backgroundColor: OCEAN.goldSoft,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  rowTitle: {
    flex: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: 1,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.base,
  },
});
