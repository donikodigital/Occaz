// mobile/app/(driver)/news.tsx
//
// v1 — Actualités : liste des articles publiés par l'admin.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconSpeakerphone } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { usePublishedArticles } from '@/hooks/usePromotions';
import { formatDateLong } from '@/utils/date';
import type { Article } from '@/types/promotions.types';

function ArticleCard({ article }: { article: Article }) {
  return (
    <OceanCard onPress={() => router.push(`/(driver)/news/${article.id}`)} style={styles.card} accessibilityLabel={article.title}>
      {article.coverImageUrl ? <Image source={{ uri: article.coverImageUrl }} style={styles.image} /> : null}
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="bold" numberOfLines={2}>
            {article.title}
          </AppText>
          {article.excerpt ? (
            <AppText variant="xs" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
              {article.excerpt}
            </AppText>
          ) : null}
          {article.publishedAt ? (
            <AppText variant="xs" color="textMuted" style={{ marginTop: 4 }}>
              {formatDateLong(article.publishedAt)}
            </AppText>
          ) : null}
        </View>
        <IconChevronRight size={16} color={colors.textMuted} />
      </View>
    </OceanCard>
  );
}

export default function NewsScreen() {
  const { data, isLoading } = usePublishedArticles();
  const articles = data?.data ?? [];

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanScreenHeader title="Actualités" onBack={() => router.back()} />
      </View>

      <ResponsiveList
        data={articles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty icon={<IconSpeakerphone size={26} color={OCEAN.base} />} title="Aucune actualité pour l'instant" text="Revenez bientôt !" />
          ) : undefined
        }
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
  },
});