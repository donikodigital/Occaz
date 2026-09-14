// mobile/src/components/ui/CalendarPicker.tsx
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react-native';
import { AppText, Card, IconButton } from '@/components/ui';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface CalendarPickerProps {
  label: string;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  /** Jour le plus ancien sélectionnable — hier par défaut, pour bloquer le passé sans compliquer l'appelant. */
  minDate?: Date;
  /**
   * Si fourni, affiche une option "Dates flexibles" en plus du calendrier
   * — pertinent pour une recherche de trajet client (pas de date précise
   * exigée), pas pour la création d'un trajet chauffeur (départ à date
   * fixe, toujours obligatoire), qui omet simplement cette prop.
   */
  flexibleLabel?: string;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
}

/** Grille de 6 semaines (42 cases), lundi en première colonne — convention française. */
function buildMonthMatrix(year: number, month: number): CalendarCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // dimanche=0..samedi=6 -> lundi=0..dimanche=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inCurrentMonth: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Lettres L M M J V S D — dérivées d'une semaine connue plutôt que codées en dur, pour rester correct si le format Intl change de convention. */
function getWeekdayLabels(): string[] {
  const monday = new Date(2024, 0, 1); // un lundi
  const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return formatter.format(day);
  });
}

const WEEKDAY_LABELS = getWeekdayLabels();

export function CalendarPicker({ label, selectedDate, onSelectDate, minDate, flexibleLabel }: CalendarPickerProps) {
  const [isOpen, setOpen] = useState(false);
  const { isTablet } = useResponsive();
  const today = useMemo(() => startOfDay(new Date()), []);
  const floor = useMemo(() => (minDate ? startOfDay(minDate) : today), [minDate, today]);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? floor);

  const weeks = useMemo(
    () => buildMonthMatrix(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(visibleMonth);

  function open() {
    setVisibleMonth(selectedDate ?? floor);
    setOpen(true);
  }

  function goToPreviousMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function handleSelectDay(date: Date) {
    onSelectDate(date);
    setOpen(false);
  }

  const triggerLabel = selectedDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }).format(selectedDate)
    : (flexibleLabel ?? 'Choisir une date');

  return (
    <View>
      {label ? (
        <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <Card onPress={open} style={styles.field}>
        <View style={styles.fieldRow}>
          <IconCalendar size={16} color={colors.textSecondary} />
          <AppText variant="base" color={selectedDate ? 'textPrimary' : 'textSecondary'} style={{ flex: 1 }}>
            {triggerLabel}
          </AppText>
        </View>
      </Card>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, isTablet && styles.sheetCentered]}>
            <View style={styles.header}>
              <AppText variant="lg" weight="semibold">
                Choisir une date
              </AppText>
              <IconButton
                icon={<IconX size={18} color={colors.textPrimary} />}
                accessibilityLabel="Fermer"
                onPress={() => setOpen(false)}
              />
            </View>

            {flexibleLabel ? (
              <Pressable
                onPress={() => {
                  onSelectDate(null);
                  setOpen(false);
                }}
                style={[styles.flexibleRow, !selectedDate && styles.flexibleRowActive]}
              >
                <AppText variant="sm" weight="medium" color={!selectedDate ? colors.onPrimary : 'textPrimary'}>
                  {flexibleLabel}
                </AppText>
              </Pressable>
            ) : null}

            <View style={styles.monthNav}>
              <IconButton
                icon={<IconChevronLeft size={18} color={colors.textPrimary} />}
                accessibilityLabel="Mois précédent"
                onPress={goToPreviousMonth}
              />
              <AppText variant="base" weight="semibold" style={styles.monthLabel}>
                {monthLabel}
              </AppText>
              <IconButton
                icon={<IconChevronRight size={18} color={colors.textPrimary} />}
                accessibilityLabel="Mois suivant"
                onPress={goToNextMonth}
              />
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((letter, index) => (
                <View key={index} style={styles.cell}>
                  <AppText variant="xs" color="textMuted" weight="medium">
                    {letter}
                  </AppText>
                </View>
              ))}
            </View>

            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.map(({ date, inCurrentMonth }) => {
                  const disabled = date.getTime() < floor.getTime();
                  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                  const isToday = isSameDay(date, today);

                  return (
                    <Pressable
                      key={date.toISOString()}
                      disabled={disabled}
                      onPress={() => handleSelectDay(date)}
                      style={styles.cell}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && styles.dayCircleSelected,
                          isToday && !isSelected && styles.dayCircleToday,
                        ]}
                      >
                        <AppText
                          variant="sm"
                          weight={isSelected ? 'semibold' : 'regular'}
                          color={
                            isSelected
                              ? colors.onPrimary
                              : disabled || !inCurrentMonth
                                ? 'textMuted'
                                : 'textPrimary'
                          }
                        >
                          {date.getDate()}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.xxs,
  },
  field: {
    padding: spacing.sm + 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetCentered: {
    maxWidth: maxContentWidth.form,
    width: '100%',
    alignSelf: 'center',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  flexibleRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flexibleRowActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: {
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxs,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: '78%',
    height: '78%',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
});
