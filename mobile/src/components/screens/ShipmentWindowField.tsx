// mobile/src/components/screens/ShipmentWindowField.tsx
// [21/09/2026] v1 — choix de la plage de dates du colis.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconInfoCircle } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { colors, spacing } from '@/theme';

export interface ShipmentWindowFieldProps {
  startDate: Date | null;
  endDate: Date | null;
  onChangeStart: (date: Date | null) => void;
  onChangeEnd: (date: Date | null) => void;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Plage de dates pendant laquelle le colis peut partir — obligatoire. Deux
 * jours choisis dans un calendrier : du premier jour à minuit jusqu'au
 * dernier jour à 23 h 59 (voir toShipmentWindow).
 */
export function ShipmentWindowField({ startDate, endDate, onChangeStart, onChangeEnd }: ShipmentWindowFieldProps) {
  function handleStart(date: Date | null) {
    onChangeStart(date);
    // La fin ne peut pas précéder le début.
    if (date && endDate && endDate < date) onChangeEnd(date);
  }

  return (
    <View style={styles.container}>
      <CalendarPicker label="Le colis peut partir à partir du" selectedDate={startDate} onSelectDate={handleStart} minDate={startOfToday()} />
      <CalendarPicker
        label="Et au plus tard le"
        selectedDate={endDate}
        onSelectDate={onChangeEnd}
        minDate={startDate ?? startOfToday()}
      />
      <View style={styles.note}>
        <IconInfoCircle size={14} color={colors.textSecondary} />
        <AppText variant="xs" color="textSecondary" style={styles.noteText}>
          Sans chauffeur avant la fin de cette période, nous vous proposons de la prolonger. Si vous ne le souhaitez
          pas, vous êtes remboursé intégralement.
        </AppText>
      </View>
    </View>
  );
}

/** Convertit deux jours en plage ISO : début à 00:00, fin à 23:59:59 (heure locale). */
export function toShipmentWindow(startDate: Date, endDate: Date): { windowStart: string; windowEnd: string } {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 0);
  return { windowStart: start.toISOString(), windowEnd: end.toISOString() };
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noteText: {
    flex: 1,
  },
});