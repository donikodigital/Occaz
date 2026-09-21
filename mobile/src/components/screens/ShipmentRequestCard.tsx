// mobile/src/components/screens/ShipmentRequestCard.tsx
// [21/09/2026] v1 — carte d'une demande d'envoi pour le chauffeur.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconBolt, IconCalendarEvent, IconClock, IconPackage, IconRuler2, IconWeight } from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatDimensions, formatWindow, timeAgo } from '@/utils/shipmentDisplay';
import type { AvailableShipment } from '@/types/shipments.types';
import { FactChip, ShipmentRoute } from './ShipmentParts';

export interface ShipmentRequestCardProps {
  shipment: AvailableShipment;
  /** Ouvre la feuille d'acceptation — toute la carte et le bouton font la même chose. */
  onAccept: () => void;
}

/**
 * Une demande d'envoi ouverte, lisible d'un coup d'œil : d'où à où, quoi,
 * combien le chauffeur touchera. Aucune coordonnée de client ici — elles ne
 * sont communiquées qu'après l'acceptation.
 */
export function ShipmentRequestCard({ shipment, onAccept }: ShipmentRequestCardProps) {
  const dimensions = formatDimensions(shipment);

  return (
    <Card onPress={onAccept} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.tile}>
          <IconPackage size={20} color={colors.accentDark} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="sm" weight="semibold" numberOfLines={1}>
            {shipment.category.name}
          </AppText>
          <View style={styles.time}>
            <IconClock size={12} color={colors.textMuted} />
            <AppText variant="xs" color="textMuted">
              {timeAgo(shipment.createdAt)}
            </AppText>
          </View>
        </View>
        {shipment.isUrgent ? (
          <Badge label="Urgent" tone="danger" icon={<IconBolt size={12} color={colors.dangerDark} />} />
        ) : null}
      </View>

      <ShipmentRoute
        from={shipment.senderLocation.label}
        to={shipment.recipientLocation.label}
      />

      <View style={styles.window}>
        <IconCalendarEvent size={14} color={colors.textSecondary} />
        <AppText variant="xs" color="textSecondary">
          {formatWindow(shipment)}
        </AppText>
      </View>

      <View style={styles.facts}>
        <FactChip icon={<IconWeight size={13} color={colors.textSecondary} />} label={`${shipment.weightKg} kg`} />
        {dimensions ? (
          <FactChip icon={<IconRuler2 size={13} color={colors.textSecondary} />} label={dimensions} />
        ) : null}
        {shipment.quantity > 1 ? <FactChip label={`${shipment.quantity} colis`} /> : null}
      </View>

      <View style={styles.footer}>
        <View>
          <AppText variant="xs" color="textSecondary">
            Vous recevrez
          </AppText>
          <AppText variant="lg" weight="bold" color="successDark">
            {formatMoney(driverNetAmount(shipment), shipment.currencyCode)}
          </AppText>
        </View>
        <Button label="Accepter" size="md" fullWidth={false} onPress={onAccept} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  window: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});