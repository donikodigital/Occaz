// mobile/src/components/auth/CountryField.tsx
// [11/10/2026] v1 — Choix du pays avec son drapeau et son indicatif (« 🇬🇳 Guinée  +224 »). `CountryField` est le champ plein écran de
// l'inscription ; `CountryPickerModal` (la liste) est aussi ouverte par la pastille d'indicatif du champ téléphone.
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react-native';
import { AppText, IconButton } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCountries } from '@/hooks/useCities';
import { useResponsive } from '@/hooks/useResponsive';
import { flagEmoji, formatDialCode } from '@/utils/phone';
import type { Country } from '@/types/geography.types';

export function CountryPickerModal({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId?: string | null;
  onSelect: (country: Country) => void;
  onClose: () => void;
}) {
  const { data: countries, isLoading } = useCountries();
  const { isTablet } = useResponsive();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, isTablet && styles.modalCentered]}>
        <View style={styles.modalHeader}>
          <AppText variant="lg" weight="semibold" style={styles.modalTitle}>
            Choisir un pays
          </AppText>
          <IconButton icon={<IconX size={18} color={colors.textPrimary} />} accessibilityLabel="Fermer" onPress={onClose} />
        </View>
        {isLoading ? <ActivityIndicator color={OCEAN.base} style={styles.loader} /> : null}
        <FlatList
          data={countries ?? []}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, indicatif ${formatDialCode(item.phoneCode)}`}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <AppText variant="xl">{flagEmoji(item.isoCode)}</AppText>
                <AppText variant="base" weight={selected ? 'semibold' : 'medium'} style={styles.rowName}>
                  {item.name}
                </AppText>
                <AppText variant="sm" color="textSecondary">
                  {formatDialCode(item.phoneCode)}
                </AppText>
                {selected ? <IconCheck size={18} color={OCEAN.base} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function CountryField({
  label,
  value,
  onSelect,
  error,
}: {
  label: string;
  value: Country | null;
  onSelect: (country: Country) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value ? value.name : 'aucun pays choisi'}`}
        style={({ pressed }) => [styles.field, error ? styles.fieldError : null, pressed && styles.pressed]}
      >
        <AppText variant="xl">{value ? flagEmoji(value.isoCode) : '🌍'}</AppText>
        <AppText variant="base" color={value ? 'textPrimary' : 'textSecondary'} style={styles.fieldText}>
          {value?.name ?? 'Choisir un pays'}
        </AppText>
        {value ? (
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {formatDialCode(value.phoneCode)}
          </AppText>
        ) : null}
        <IconChevronDown size={16} color={colors.textSecondary} />
      </Pressable>
      {error ? (
        <AppText variant="xs" color="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <CountryPickerModal visible={open} selectedId={value?.id} onSelect={onSelect} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  fieldText: { flex: 1 },
  error: { marginTop: spacing.xxs },
  pressed: { opacity: 0.8 },
  modal: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl },
  modalCentered: { maxWidth: 520, alignSelf: 'center', width: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { flex: 1 },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.xs, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { backgroundColor: OCEAN.mist, borderColor: OCEAN.base },
  rowName: { flex: 1 },
});
