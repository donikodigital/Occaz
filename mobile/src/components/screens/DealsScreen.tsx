// mobile/src/components/screens/DealsScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [13/10/2026] v1 — Bons plans, commun aux espaces client et conducteur (les deux écrans étaient identiques).
// Correctif d'affichage : une image qui ne charge pas (adresse d'une page au lieu d'une image, lien cassé) laissait un grand bloc bleu vide
// au-dessus du titre. Désormais le bloc n'apparaît que quand l'image est réellement chargée ; sinon la carte ne montre que son texte,
// avec une pastille 🎟️ pour garder un repère visuel.
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconTicket } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useActiveDeals } from '@/hooks/usePromotions';
import type { Deal } from '@/types/promotions.types';
import { useT } from '@/i18n';

function DealCard({ deal }: { deal: Deal }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(deal.imageUrl) && !imageFailed;

  return (
    <OceanCard style={styles.card}>
      {showImage ? (
        <Image
          source={{ uri: deal.imageUrl as string }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={styles.titleRow}>
        {!showImage ? (
          <View style={styles.badge}>
            <IconTicket size={18} color={OCEAN.base} />
          </View>
        ) : null}
        <View style={styles.texts}>
          <AppText variant="sm" weight="bold">
            {deal.title}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {deal.description}
          </AppText>
        </View>
      </View>
    </OceanCard>
  );
}

export function DealsScreen() {
  const t = useT();
  const { data: deals, isLoading } = useActiveDeals();

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanHeroHeader title={t('Bons plans')} subtitle={t('Les offres du moment')} icon={<IconTicket />} onBack={() => router.back()} />
      </View>

      <ResponsiveList
        data={deals ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty icon={<IconTicket size={26} color={OCEAN.base} />} title={t("Aucun bon plan pour l'instant")} text={t('Revenez bientôt !')} />
          ) : undefined
        }
        renderItem={({ item }) => <DealCard deal={item} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { padding: spacing.md, gap: spacing.sm },
  image: { width: '100%', height: 140, borderRadius: 14, backgroundColor: OCEAN.mist },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
});
