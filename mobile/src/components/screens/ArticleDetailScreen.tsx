// mobile/src/components/screens/ArticleDetailScreen.tsx
//
// [07/10/2026] v1 — Détail d'une actualité (partagé client / conducteur), habillé comme les autres écrans bleu océan :
//   - un bandeau (hero) : la photo de couverture sous un voile bleu profond quand il y en a une, sinon le fond aux reflets ;
//     le bouton Retour, la pastille « Actualité », la date, le temps de lecture et le titre en grand ;
//   - le chapeau de l'article (l'extrait) mis en avant, avec un filet de couleur ;
//   - le texte dans une carte, aéré : un paragraphe par bloc séparé par une ligne vide, interligne confortable ;
//   - un état « Actualité introuvable » au lieu d'un chargement sans fin quand l'article n'existe plus ou n'est plus publié.
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconCalendarEvent, IconClock, IconSpeakerphone } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanHeroCard } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useArticle } from '@/hooks/usePromotions';
import { formatDateLong } from '@/utils/date';

export interface ArticleDetailScreenProps {
  /** Liste des actualités du groupe appelant : repli du bouton Retour quand l'écran est ouvert sans historique (lien direct). */
  newsPath: '/(customer)/news' | '/(driver)/news';
}

const WORDS_PER_MINUTE = 200;

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Un bloc de texte par paragraphe (lignes vides) ; les retours à la ligne simples sont conservés à l'intérieur d'un bloc. */
function paragraphsOf(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function MetaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.metaPill}>
      {icon}
      <AppText variant="xs" weight="semibold" color={OCEAN.onDark}>
        {label}
      </AppText>
    </View>
  );
}

export function ArticleDetailScreen({ newsPath }: ArticleDetailScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: article, isLoading } = useArticle(id);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(newsPath);
  }

  if (isLoading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator color={OCEAN.base} />
      </ScreenContainer>
    );
  }

  if (!article) {
    return (
      <ScreenContainer style={styles.center}>
        <OceanEmpty
          icon={<IconSpeakerphone size={28} color={OCEAN.base} />}
          title="Actualité introuvable"
          text="Cet article n'est plus disponible."
          action={<OceanButton label="Retour aux actualités" onPress={goBack} style={styles.emptyButton} />}
        />
      </ScreenContainer>
    );
  }

  const hasCover = Boolean(article.coverImageUrl);
  const paragraphs = paragraphsOf(article.content);
  const lead = article.excerpt?.trim();

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroCard style={[styles.hero, hasCover ? styles.heroWithCover : null]}>
        {hasCover ? (
          <>
            <Image source={{ uri: article.coverImageUrl as string }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFill, styles.coverVeil]} />
          </>
        ) : null}

        <View style={styles.heroTop}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <IconArrowLeft size={20} color={OCEAN.onDark} />
          </Pressable>
          <View style={styles.kindPill}>
            <IconSpeakerphone size={14} color={OCEAN.goldInk} />
            <AppText variant="xs" weight="bold" color={OCEAN.goldInk}>
              ACTUALITÉ
            </AppText>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <View style={styles.metaRow}>
            {article.publishedAt ? (
              <MetaPill
                icon={<IconCalendarEvent size={13} color={OCEAN.sky} />}
                label={capitalize(formatDateLong(article.publishedAt))}
              />
            ) : null}
            <MetaPill icon={<IconClock size={13} color={OCEAN.sky} />} label={`${readingMinutes(article.content)} min de lecture`} />
          </View>
          <AppText variant="xxl" weight="bold" color={OCEAN.onDark} style={styles.title}>
            {article.title}
          </AppText>
        </View>
      </OceanHeroCard>

      <OceanCard style={styles.bodyCard}>
        {lead ? (
          <View style={styles.leadWrap}>
            <View style={styles.leadBar} />
            <AppText variant="base" weight="semibold" color={OCEAN.deep} style={styles.lead}>
              {lead}
            </AppText>
          </View>
        ) : null}

        {paragraphs.map((paragraph, index) => (
          <AppText key={index} variant="base" color="textPrimary" style={styles.paragraph}>
            {paragraph}
          </AppText>
        ))}
      </OceanCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.75,
  },

  // Bandeau
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg,
    minHeight: 210,
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  heroWithCover: {
    minHeight: 280,
  },
  coverVeil: {
    backgroundColor: 'rgba(8,58,99,0.62)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.gold,
  },
  heroBottom: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    lineHeight: 34,
  },

  // Texte
  bodyCard: {
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  leadWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  leadBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: OCEAN.bright,
  },
  lead: {
    flex: 1,
    lineHeight: 25,
  },
  paragraph: {
    lineHeight: 26,
  },
});
