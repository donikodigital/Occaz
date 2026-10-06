// mobile/app/(driver)/(tabs)/wallet.tsx
//
// [05/10/2026] v3 — Portefeuille refait.
//   - Bandeau allégé : une icône de portefeuille (avec sa pièce) pour comprendre d'un coup d'œil que c'est de l'argent gardé, le
//     solde disponible, l'argent en attente, et « Retirer ». Les retraits récents n'y sont plus : ils sont dans l'historique.
//   - [06/10/2026] Vue d'ensemble compacte : une ligne par catégorie (icône, nom et nombre, total) au lieu de grandes tuiles.
//   - Filtres par catégorie — Tout, Trajets, Envois, Retraits, Autres — avec le TOTAL de chaque catégorie : une vue d'ensemble en
//     tuiles, et, dès qu'un filtre est choisi, une carte de total (gagné, retiré…) et la liste correspondante.
//   - Historique regroupé par jour, chaque opération dit de quoi il s'agit (tronçon, itinéraire de l'envoi, mode de retrait), son
//     heure, son statut — celui de la demande pour un retrait. (La conversion de devise n'est plus affichée.)
//   - « Afficher plus » charge la suite : les totaux portent sur tout l'historique, pas seulement sur ce qui est affiché.
//
// v2 — Habillage bleu océan, comme l'espace client.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconCashBanknote,
  IconClockHour4,
  IconCoin,
  IconLayoutGrid,
  IconPackage,
  IconReceipt2,
  IconRoute,
  IconWallet,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanHeroCard, OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyWallet, useMyWalletHistory } from '@/hooks/useWallet';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/date';
import {
  FILTER_EMPTY_TEXT,
  FILTER_LABELS,
  FILTER_TOTAL_LABELS,
  WALLET_FILTERS,
  groupByDay,
  signOf,
  txStatus,
  txSubtitle,
  txTitle,
} from '@/utils/walletHistory';
import type { WalletTransaction, WalletTxFilter } from '@/types/wallets.types';

type Category = Exclude<WalletTxFilter, 'ALL'>;

const FILTER_ICONS: Record<WalletTxFilter, typeof IconRoute> = {
  ALL: IconLayoutGrid,
  TRIPS: IconRoute,
  SHIPMENTS: IconPackage,
  PAYOUTS: IconCashBanknote,
  OTHER: IconReceipt2,
};

/** Couleurs de chaque catégorie : les mêmes sur la tuile, la carte de total et l'icône de chaque ligne. */
const CATEGORY_TONES: Record<Category, { background: string; foreground: string }> = {
  TRIPS: { background: OCEAN.mist, foreground: OCEAN.base },
  SHIPMENTS: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
  PAYOUTS: { background: '#EEF0F4', foreground: '#4A5568' },
  OTHER: { background: '#FDE8E8', foreground: colors.danger },
};

const PILL_TONE: Record<'ocean' | 'success' | 'danger' | 'neutral', OceanPillTone> = {
  ocean: 'ocean',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

function countText(filter: WalletTxFilter, count: number): string {
  const plural = count > 1 ? 's' : '';
  switch (filter) {
    case 'TRIPS':
      return `${count} trajet${plural}`;
    case 'SHIPMENTS':
      return `${count} envoi${plural}`;
    case 'PAYOUTS':
      return `${count} retrait${plural}`;
    default:
      return `${count} opération${plural}`;
  }
}

/** « +4 495 XOF » / « −13 950 XOF » ; « 0 XOF » sans signe. */
function signedMoney(amount: string | number, currencyCode: string): string {
  return `${signOf(amount)}${formatMoney(Math.abs(Number(amount)), currencyCode)}`;
}

function amountColor(amount: string | number): 'success' | 'danger' | 'textPrimary' {
  const value = Number(amount);
  if (value > 0) return 'success';
  if (value < 0) return 'danger';
  return 'textPrimary';
}

// ---------------------------------------------------------------------------
// Bandeau : l'argent gardé, prêt à retirer
// ---------------------------------------------------------------------------

function WalletHero({
  balance,
  pending,
  currencyCode,
}: {
  balance: string | undefined;
  pending: string | undefined;
  currencyCode: string;
}) {
  const hasPending = pending !== undefined && Number(pending) > 0;
  return (
    <OceanHeroCard style={styles.hero}>
      <View style={styles.heroTop}>
        {/* Portefeuille + pièce : « de l'argent est rangé ici » */}
        <View style={styles.walletBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <IconWallet size={30} color={OCEAN.onDark} />
          <View style={styles.coin}>
            <IconCoin size={15} color={OCEAN.goldInk} />
          </View>
        </View>
        <View style={styles.heroTitles}>
          <AppText variant="base" weight="semibold" color={OCEAN.onDark}>
            Mon portefeuille
          </AppText>
          <AppText variant="xs" color={OCEAN.sky}>
            Votre argent, prêt à être retiré
          </AppText>
        </View>
      </View>

      <View>
        <AppText variant="xs" weight="medium" color={OCEAN.sky} style={styles.heroLabel}>
          Solde disponible
        </AppText>
        <AppText variant="display" weight="bold" color={OCEAN.onDark} numberOfLines={1} adjustsFontSizeToFit>
          {balance !== undefined ? formatMoney(balance, currencyCode) : '…'}
        </AppText>
      </View>

      {hasPending ? (
        <View style={styles.pendingPill}>
          <IconClockHour4 size={14} color={OCEAN.onDark} />
          <AppText variant="xs" color={OCEAN.sky}>
            + {formatMoney(pending, currencyCode)} en attente · libéré après la dépose
          </AppText>
        </View>
      ) : null}

      <OceanButton label="Retirer" onPress={() => router.push('/(driver)/payout-new')} style={styles.withdrawButton} />
    </OceanHeroCard>
  );
}

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

function FilterChip({
  filter,
  active,
  count,
  onPress,
}: {
  filter: WalletTxFilter;
  active: boolean;
  count: number | undefined;
  onPress: () => void;
}) {
  const Icon = FILTER_ICONS[filter];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${FILTER_LABELS[filter]}${count !== undefined ? `, ${count}` : ''}`}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Icon size={16} color={active ? OCEAN.onDark : OCEAN.base} />
      <AppText variant="sm" weight="semibold" color={active ? OCEAN.onDark : OCEAN.base}>
        {FILTER_LABELS[filter]}
      </AppText>
      {count !== undefined ? (
        <View style={[styles.chipCount, active && styles.chipCountActive]}>
          <AppText variant="xs" weight="bold" color={active ? OCEAN.onDark : OCEAN.base}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Vue d'ensemble : une tuile par catégorie avec son total ; toucher une tuile applique le filtre. */
function OverviewTile({
  category,
  total,
  count,
  currencyCode,
  onPress,
}: {
  category: Category;
  total: string;
  count: number;
  currencyCode: string;
  onPress: () => void;
}) {
  const Icon = FILTER_ICONS[category];
  const tone = CATEGORY_TONES[category];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${FILTER_LABELS[category]} : ${signedMoney(total, currencyCode)}, ${countText(category, count)}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: tone.background }]}>
        <Icon size={18} color={tone.foreground} />
      </View>
      <View style={styles.tileText}>
        <AppText variant="sm" weight="semibold">
          {FILTER_LABELS[category]}
        </AppText>
        <AppText variant="xs" color="textMuted">
          {countText(category, count)}
        </AppText>
      </View>
      <AppText variant="base" weight="bold" color={amountColor(total)} numberOfLines={1}>
        {signedMoney(total, currencyCode)}
      </AppText>
    </Pressable>
  );
}

/** Carte de total d'un filtre actif : le montant de la catégorie, ce qui est encore en cours, et le retour à « Tout ». */
function TotalCard({
  category,
  total,
  pending,
  count,
  currencyCode,
  onReset,
}: {
  category: Category;
  total: string;
  pending: string;
  count: number;
  currencyCode: string;
  onReset: () => void;
}) {
  const Icon = FILTER_ICONS[category];
  const tone = CATEGORY_TONES[category];
  const hasPending = Number(pending) !== 0;
  return (
    <OceanCard style={styles.totalCard}>
      <View style={styles.totalHeader}>
        <View style={[styles.totalIcon, { backgroundColor: tone.background }]}>
          <Icon size={22} color={tone.foreground} />
        </View>
        <View style={styles.totalTitles}>
          <AppText variant="sm" weight="semibold" color="textSecondary">
            {FILTER_TOTAL_LABELS[category]}
          </AppText>
          <AppText variant="xs" color="textMuted">
            {countText(category, count)}
          </AppText>
        </View>
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel="Retirer le filtre et tout afficher"
          hitSlop={8}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
        >
          <IconX size={16} color={OCEAN.base} />
        </Pressable>
      </View>
      <AppText variant="xxl" weight="bold" color={amountColor(total)} numberOfLines={1} adjustsFontSizeToFit>
        {signedMoney(total, currencyCode)}
      </AppText>
      {hasPending ? (
        <AppText variant="xs" color="textSecondary">
          Encore en cours : {signedMoney(pending, currencyCode)} (pas inclus ci-dessus)
        </AppText>
      ) : null}
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

function TransactionRow({ tx, currencyCode }: { tx: WalletTransaction; currencyCode: string }) {
  const category: Category = tx.category ?? 'OTHER';
  const tone = CATEGORY_TONES[category];
  const Icon = FILTER_ICONS[category];
  const subtitle = txSubtitle(tx);
  const status = txStatus(tx);
  return (
    <OceanCard style={styles.txCard}>
      <View style={[styles.txIcon, { backgroundColor: tone.background }]}>
        <Icon size={18} color={tone.foreground} />
      </View>
      <View style={styles.txText}>
        <AppText variant="sm" weight="semibold">
          {txTitle(tx)}
        </AppText>
        {subtitle ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant="xs" color="textMuted">
          {formatTime(tx.createdAt)}
        </AppText>
      </View>
      <View style={styles.txAmountBlock}>
        <AppText variant="sm" weight="bold" color={amountColor(tx.amount)}>
          {signedMoney(tx.amount, currencyCode)}
        </AppText>
        <OceanPill label={status.label} tone={PILL_TONE[status.tone]} />
      </View>
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function DriverWalletScreen() {
  const [filter, setFilter] = useState<WalletTxFilter>('ALL');
  const { data: wallet } = useMyWallet();
  const { data, isLoading, isPlaceholderData, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyWalletHistory(filter);

  const currencyCode = wallet?.currency.isoCode ?? 'GNF';
  const summary = data?.pages[0]?.summary;
  const transactions = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const groups = useMemo(() => groupByDay(transactions), [transactions]);

  const overviewCategories = (['TRIPS', 'SHIPMENTS', 'PAYOUTS', 'OTHER'] as Category[]).filter(
    // « Autres » (remboursements, ajustements) n'apparaît dans la vue d'ensemble que s'il y en a.
    (category) => category !== 'OTHER' || (summary?.OTHER.count ?? 0) > 0,
  );

  return (
    <ScreenContainer scroll padded={false} maxWidth="wide">
      <View style={styles.heroWrap}>
        <WalletHero balance={wallet?.balance} pending={wallet?.pendingBalance} currencyCode={currencyCode} />
      </View>

      <View style={styles.body}>
        {/* Filtres */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {WALLET_FILTERS.map((item) => (
            <FilterChip
              key={item}
              filter={item}
              active={filter === item}
              count={summary?.[item].count}
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>

        {/* Totaux : vue d'ensemble, ou total de la catégorie choisie */}
        {summary ? (
          filter === 'ALL' ? (
            <View>
              <AppText variant="base" weight="semibold" color={OCEAN.deep} style={styles.sectionTitle}>
                Vue d'ensemble
              </AppText>
              <View style={styles.tiles}>
                {overviewCategories.map((category) => (
                  <OverviewTile
                    key={category}
                    category={category}
                    total={summary[category].total}
                    count={summary[category].count}
                    currencyCode={currencyCode}
                    onPress={() => setFilter(category)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <TotalCard
              category={filter}
              total={summary[filter].total}
              pending={summary[filter].pending}
              count={summary[filter].count}
              currencyCode={currencyCode}
              onReset={() => setFilter('ALL')}
            />
          )
        ) : null}

        {/* Historique */}
        <View style={[styles.history, isPlaceholderData && styles.loadingDim]}>
          <AppText variant="base" weight="semibold" color={OCEAN.deep} style={styles.sectionTitle}>
            {filter === 'ALL' ? 'Historique' : `Historique · ${FILTER_LABELS[filter]}`}
          </AppText>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : transactions.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <IconReceipt2 size={22} color={colors.textMuted} />
              </View>
              <AppText variant="sm" color="textMuted" align="center">
                {FILTER_EMPTY_TEXT[filter]}
              </AppText>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <AppText variant="xs" weight="semibold" color={OCEAN.base} style={styles.groupLabel}>
                  {group.label.toUpperCase()}
                </AppText>
                <View style={styles.groupItems}>
                  {group.items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} currencyCode={currencyCode} />
                  ))}
                </View>
              </View>
            ))
          )}

          {hasNextPage ? (
            <OceanButton
              label="Afficher plus"
              variant="soft"
              onPress={() => fetchNextPage()}
              loading={isFetchingNextPage}
              style={styles.moreButton}
            />
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  loadingDim: { opacity: 0.55 },

  // Bandeau
  heroWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
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
  walletBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  coin: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.gold,
    borderWidth: 2,
    borderColor: OCEAN.deep,
  },
  heroTitles: {
    flex: 1,
    gap: 1,
  },
  heroLabel: {
    opacity: 0.9,
    marginBottom: 2,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  withdrawButton: {
    alignSelf: 'flex-start',
    minWidth: 170,
  },

  // Corps
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },

  // Filtres
  chipsScroll: {
    marginHorizontal: -spacing.lg,
  },
  chips: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
  },
  chipActive: {
    backgroundColor: OCEAN.base,
  },
  chipCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // Vue d'ensemble
  tiles: {
    gap: spacing.xs,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    flex: 1,
    gap: 1,
  },

  // Carte de total
  totalCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  totalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalTitles: {
    flex: 1,
  },
  resetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },

  // Historique
  history: {
    paddingBottom: spacing.xl,
  },
  loader: {
    marginTop: spacing.lg,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupLabel: {
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  groupItems: {
    gap: spacing.xs,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txText: {
    flex: 1,
    gap: 1,
  },
  txAmountBlock: {
    alignItems: 'flex-end',
    gap: 5,
  },
  moreButton: {
    marginTop: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
});
