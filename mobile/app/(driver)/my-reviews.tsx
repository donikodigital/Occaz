// mobile/app/(driver)/my-reviews.tsx
//
// v1 — « Mes avis » : les notations que le client a données (pas reçues),
// une carte par avis avec la personne notée, le contexte (trajet ou envoi)
// et le commentaire s'il y en a un. État vide avec un renvoi vers l'activité.

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMessageStar, IconRoute, IconStarFilled, IconPackage } from '@tabler/icons-react-native';
import { AppText, Avatar, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useGivenRatings } from '@/hooks/useRatings';
import { formatDateLong } from '@/utils/date';
import type { GivenRating } from '@/types/ratings.types';

function Stars({ score }: { score: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }).map((_, index) => (
        <IconStarFilled key={index} size={14} color={index < score ? OCEAN.gold : colors.border} />
      ))}
    </View>
  );
}

function ReviewCard({ rating }: { rating: GivenRating }) {
  const initials = rating.targetName
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <OceanCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar initials={initials} imageUri={rating.targetPhotoUrl ?? undefined} size={40} />
        <View style={styles.cardHeaderText}>
          <AppText variant="sm" weight="semibold" numberOfLines={1}>
            {rating.targetName}
          </AppText>
          {rating.context ? (
            <View style={styles.contextRow}>
              {rating.context.type === 'trip' ? (
                <IconRoute size={12} color={colors.textSecondary} />
              ) : (
                <IconPackage size={12} color={colors.textSecondary} />
              )}
              <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                {rating.context.route}
              </AppText>
            </View>
          ) : null}
        </View>
        <Stars score={rating.score} />
      </View>

      {rating.comment ? (
        <AppText variant="sm" color="textSecondary" style={styles.comment}>
          « {rating.comment} »
        </AppText>
      ) : null}

      <AppText variant="xs" color="textMuted">
        {formatDateLong(rating.createdAt)}
      </AppText>
    </OceanCard>
  );
}

export default function MyReviewsScreen() {
  const { data, isLoading } = useGivenRatings();
  const ratings = data?.data ?? [];

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanScreenHeader title="Mes avis" subtitle="Les notes que vous avez données" onBack={() => router.back()} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={OCEAN.base} />
        </View>
      ) : (
        <ResponsiveList
          data={ratings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <OceanEmpty
              icon={<IconMessageStar size={28} color={OCEAN.base} />}
              title="Aucun avis pour l'instant"
              text="Notez un chauffeur après un trajet ou un envoi terminé — vos avis apparaîtront ici."
              action={
                <OceanButton
                  label="Voir mon activité"
                  variant="outline"
                  onPress={() => router.push('/(driver)/(tabs)/trips')}
                  style={styles.emptyButton}
                />
              }
            />
          }
          renderItem={({ item }) => <ReviewCard rating={item} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  comment: {
    fontStyle: 'italic',
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});