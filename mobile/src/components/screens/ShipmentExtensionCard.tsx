// mobile/src/components/screens/ShipmentExtensionCard.tsx
// [21/09/2026] v1 — le client prolonge sa demande ou demande à être remboursé.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconAlertTriangle } from '@tabler/icons-react-native';
import { AppText, Button } from '@/components/ui';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { colors, radius, spacing } from '@/theme';

export interface ShipmentExtensionCardProps {
  /** Reçoit la nouvelle fin de plage (ISO, 23 h 59 du jour choisi). */
  onExtend: (windowEnd: string) => void;
  /** Le client renonce : l'envoi est annulé et intégralement remboursé. */
  onRefund: () => void;
  isExtending: boolean;
  isRefunding: boolean;
  errorMessage?: string;
}

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Affichée quand la plage de dates est terminée sans chauffeur : le client
 * prolonge la période ou demande à être remboursé. Sans réponse, le
 * remboursement intégral est déclenché automatiquement au bout du délai.
 */
export function ShipmentExtensionCard({ onExtend, onRefund, isExtending, isRefunding, errorMessage }: ShipmentExtensionCardProps) {
  const [newEndDate, setNewEndDate] = useState<Date | null>(null);

  function handleExtend() {
    if (!newEndDate) return;
    const end = new Date(newEndDate);
    end.setHours(23, 59, 59, 0);
    onExtend(end.toISOString());
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <IconAlertTriangle size={18} color={colors.accentDark} />
        <AppText variant="sm" weight="semibold" color={colors.accentDark} style={styles.title}>
          Aucun chauffeur avant la fin de la période
        </AppText>
      </View>
      <AppText variant="sm" color={colors.accentDark}>
        Souhaitez-vous prolonger votre demande ? Les chauffeurs seront prévenus de nouveau. Sinon, votre paiement vous
        est remboursé intégralement.
      </AppText>

      <CalendarPicker label="Nouvelle date limite" selectedDate={newEndDate} onSelectDate={setNewEndDate} minDate={tomorrow()} />

      {errorMessage ? (
        <AppText variant="sm" color="danger">
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Prolonger ma demande" onPress={handleExtend} disabled={!newEndDate || isRefunding} loading={isExtending} />
      <Button label="Non, me rembourser" variant="outline" onPress={onRefund} disabled={isExtending} loading={isRefunding} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentLight,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
  },
});