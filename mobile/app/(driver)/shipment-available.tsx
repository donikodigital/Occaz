// mobile/app/(driver)/shipment-available.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconMapPin, IconPackage } from '@tabler/icons-react-native';
import { AppText, Card, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useAvailableShipments } from '@/hooks/useDriverShipments';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { formatMoney } from '@/utils/money';
import type { Shipment } from '@/types/shipments.types';
import type { City } from '@/types/geography.types';

function ShipmentCard({ shipment, onPress }: { shipment: Shipment; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <IconPackage size={18} color={colors.accentDark} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold" numberOfLines={1}>
            {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
          </AppText>
          <AppText variant="xs" color="textSecondary" numberOfLines={1}>
            {shipment.senderLocation?.label ?? 'Départ'} → {shipment.recipientLocation?.label ?? 'Arrivée'}
          </AppText>
        </View>
        <AppText variant="sm" weight="semibold">
          {formatMoney(shipment.price, '')}
        </AppText>
      </View>
      {shipment.isUrgent ? (
        <View style={styles.urgentBadge}>
          <AppText variant="xs" weight="semibold" color="danger">
            Urgent
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

export default function AvailableShipmentsScreen() {
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [destinationCity, setDestinationCity] = useState<City | null>(null);

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (!citySelection) return;
    if (citySelection.field === 'available-origin') setOriginCity(citySelection.city);
    else if (citySelection.field === 'available-destination') setDestinationCity(citySelection.city);
    consumeCitySelection();
  }, [citySelection, consumeCitySelection]);

  const { data, isLoading } = useAvailableShipments({
    originCityId: originCity?.id,
    destinationCityId: destinationCity?.id,
    limit: 20,
  });

  function openPicker(field: 'available-origin' | 'available-destination') {
    openCityPicker(field);
    router.push('/(driver)/select-city');
  }

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Envois disponibles
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.filters}>
        <Pressable onPress={() => openPicker('available-origin')} style={styles.filterChip}>
          <IconMapPin size={13} color={colors.textSecondary} />
          <AppText variant="xs" weight="medium">
            {originCity?.name ?? 'Ville de départ'}
          </AppText>
        </Pressable>
        <Pressable onPress={() => openPicker('available-destination')} style={styles.filterChip}>
          <IconMapPin size={13} color={colors.textSecondary} />
          <AppText variant="xs" weight="medium">
            {destinationCity?.name ?? "Ville d'arrivée"}
          </AppText>
        </Pressable>
      </View>

      <ResponsiveList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading
            ? () => (
                <AppText variant="sm" color="textMuted" style={styles.empty}>
                  Aucun envoi disponible pour le moment.
                </AppText>
              )
            : undefined
        }
        renderItem={({ item }) => (
          <ShipmentCard shipment={item} onPress={() => router.push(`/(driver)/shipment/${item.id}`)} />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  card: {
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerLight,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
