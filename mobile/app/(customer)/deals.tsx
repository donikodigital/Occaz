// mobile/app/(customer)/deals.tsx
//
// v1 — Bons plans : contenu éditorial géré par l'admin.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconTicket } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useActiveDeals } from '@/hooks/usePromotions';
import type { Deal } from '@/types/promotions.types';

function DealCard({ deal }: { deal: Deal }) {
  return (
    <OceanCard style={styles.card}>
      {deal.imageUrl ? <Image source={{ uri: deal.imageUrl }} style={styles.image} /> : null}
      <AppText variant="sm" weight="bold">
        {deal.title}
      </AppText>
      <AppText variant="xs" color="textSecondary">
        {deal.description}
      </AppText>
    </OceanCard>
  );
}

export default function DealsScreen() {
  const { data: deals, isLoading } = useActiveDeals();

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanScreenHeader title="Bons plans" onBack={() => router.back()} />
      </View>

      <ResponsiveList
        data={deals ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty icon={<IconTicket size={26} color={OCEAN.base} />} title="Aucun bon plan pour l'instant" text="Revenez bientôt !" />
          ) : undefined
        }
        renderItem={({ item }) => <DealCard deal={item} />}
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
    gap: spacing.xs,
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    marginBottom: spacing.xs,
    backgroundColor: OCEAN.mist,
  },
});