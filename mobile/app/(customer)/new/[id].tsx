// mobile/app/(customer)/news/[id].tsx
//
// v1 — Détail d'un article.

import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useArticle } from '@/hooks/usePromotions';
import { formatDateLong } from '@/utils/date';

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: article, isLoading } = useArticle(id);

  if (isLoading || !article) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator color={OCEAN.base} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Actualité" onBack={() => router.back()} />

      {article.coverImageUrl ? <Image source={{ uri: article.coverImageUrl }} style={styles.image} /> : null}

      <AppText variant="xl" weight="bold" color={OCEAN.deep} style={styles.title}>
        {article.title}
      </AppText>
      {article.publishedAt ? (
        <AppText variant="xs" color="textMuted" style={styles.date}>
          {formatDateLong(article.publishedAt)}
        </AppText>
      ) : null}

      <AppText variant="sm" color="textSecondary" style={styles.content}>
        {article.content}
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    backgroundColor: OCEAN.mist,
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: 2,
  },
  date: {
    marginBottom: spacing.md,
  },
  content: {
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
});