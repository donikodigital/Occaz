// mobile/src/components/ui/TimePicker.tsx
//
// v1.1 — Corrige la sélection qui ne se validait jamais sur le web :
// onMomentumScrollEnd ne se déclenche pas de façon fiable pour un
// défilement à la molette (pas de vraie inertie côté navigateur).
// Remplacé par un debounce sur onScroll (fonctionne quelle que soit la
// source du défilement) + chaque valeur est désormais cliquable pour
// une sélection directe, plus naturelle sur desktop. Reste par ailleurs
// identique à la v1.0.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { IconClock, IconX } from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton } from '@/components/ui';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface TimeValue {
  hour: number;
  minute: number;
}

export interface TimePickerProps {
  label: string;
  value: TimeValue | null;
  onChange: (value: TimeValue) => void;
  /** Première heure sélectionnable (0-23). */
  startHour?: number;
  /** Dernière heure sélectionnable (0-23). */
  endHour?: number;
  /** Pas des minutes proposées. */
  minuteStep?: number;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2);
const SETTLE_DELAY_MS = 120;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function WheelColumn({
  values,
  selectedValue,
  onSelectIndex,
}: {
  values: number[];
  selectedValue: number;
  onSelectIndex: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(frame);
    // volontairement limité au montage de cette instance (remontée à
    // chaque ouverture via la prop `key` posée par TimePicker) : les
    // défilements suivants sont pilotés par l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function commitOffset(offsetY: number) {
    const index = Math.min(values.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    onSelectIndex(index);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // Détecte la fin du défilement par un timer plutôt que de dépendre
    // uniquement de onMomentumScrollEnd : sur web, un défilement à la
    // molette souris ne déclenche pas toujours cet événement (pas de
    // vraie inertie), ce qui bloquait la sélection. Le timer, lui,
    // fonctionne quelle que soit la source du défilement.
    settleTimer.current = setTimeout(() => commitOffset(offsetY), SETTLE_DELAY_MS);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    commitOffset(event.nativeEvent.contentOffset.y);
  }

  function handlePressItem(index: number) {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    onSelectIndex(index);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ height: WHEEL_HEIGHT }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleMomentumEnd}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PADDING_COUNT }}
    >
      {values.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable key={item} onPress={() => handlePressItem(index)} style={styles.wheelItem}>
            <AppText
              variant={isSelected ? 'lg' : 'base'}
              weight={isSelected ? 'semibold' : 'regular'}
              color={isSelected ? 'textPrimary' : 'textMuted'}
            >
              {pad2(item)}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimePicker({ label, value, onChange, startHour = 0, endHour = 23, minuteStep = 15 }: TimePickerProps) {
  const [isOpen, setOpen] = useState(false);
  const { isTablet } = useResponsive();

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  const [draftHour, setDraftHour] = useState(value?.hour ?? hours[0]);
  const [draftMinute, setDraftMinute] = useState(value?.minute ?? 0);

  function open() {
    setDraftHour(value?.hour ?? hours[0]);
    setDraftMinute(value?.minute ?? 0);
    setOpen(true);
  }

  function confirm() {
    onChange({ hour: draftHour, minute: draftMinute });
    setOpen(false);
  }

  const triggerLabel = value ? `${pad2(value.hour)}h${pad2(value.minute)}` : 'Choisir une heure';

  return (
    <View>
      {label ? (
        <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <Card onPress={open} style={styles.field}>
        <View style={styles.fieldRow}>
          <IconClock size={16} color={colors.textSecondary} />
          <AppText variant="base" color={value ? 'textPrimary' : 'textSecondary'} style={{ flex: 1 }}>
            {triggerLabel}
          </AppText>
        </View>
      </Card>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, isTablet && styles.sheetCentered]}>
            <View style={styles.header}>
              <AppText variant="lg" weight="semibold">
                Choisir une heure
              </AppText>
              <IconButton
                icon={<IconX size={18} color={colors.textPrimary} />}
                accessibilityLabel="Fermer"
                onPress={() => setOpen(false)}
              />
            </View>

            <View style={styles.wheelRow}>
              <View style={styles.wheelBand} pointerEvents="none" />
              <View style={styles.wheelColumn}>
                <WheelColumn
                  key={isOpen ? 'hour-open' : 'hour-closed'}
                  values={hours}
                  selectedValue={draftHour}
                  onSelectIndex={(index) => setDraftHour(hours[index])}
                />
              </View>
              <AppText variant="lg" weight="semibold" style={styles.wheelSeparator}>
                :
              </AppText>
              <View style={styles.wheelColumn}>
                <WheelColumn
                  key={isOpen ? 'minute-open' : 'minute-closed'}
                  values={minutes}
                  selectedValue={draftMinute}
                  onSelectIndex={(index) => setDraftMinute(minutes[index])}
                />
              </View>
            </View>

            <Button label="Valider" onPress={confirm} />
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
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing.lg,
  },
  wheelBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * PADDING_COUNT,
    height: ITEM_HEIGHT,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  wheelColumn: {
    width: 72,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSeparator: {
    marginHorizontal: spacing.xs,
  },
});