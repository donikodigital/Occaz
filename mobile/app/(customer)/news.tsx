// mobile/app/(customer)/news.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] v2 — en-tête en bandeau (héro) bleu océan, comme les autres pages. Le reste de l'écran est inchangé.
//
// v1 — Actualités : liste des articles publiés par l'admin.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconSpeakerphone } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { usePublishedArticles } from '@/hooks/usePromotions';
import { formatDateLong } from '@/utils/date';
import type { Article } from '@/types/promotions.types';
import { useT } from '@/i18n';

function ArticleCard({ article }: { article: Article }) {
  return (
    <OceanCard onPress={() => router.push(`/(customer)/news/${article.id}`)} style={styles.card} accessibilityLabel={article.title}>
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
  const t = useT();
  const { data, isLoading } = usePublishedArticles();
  const articles = data?.data ?? [];

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanHeroHeader title={t('Actualités')} subtitle={t('Les dernières nouvelles')} icon={<IconSpeakerphone />} onBack={() => router.back()} />
      </View>

      <ResponsiveList
        data={articles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty icon={<IconSpeakerphone size={26} color={OCEAN.base} />} title={t("Aucune actualité pour l'instant")} text={t('Revenez bientôt !')} />
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
