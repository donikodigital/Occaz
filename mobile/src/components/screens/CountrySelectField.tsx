// mobile/src/components/screens/CountrySelectField.tsx
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconChevronDown, IconWorld, IconX } from '@tabler/icons-react-native';
import { AppText, IconButton } from '@/components/ui';
import { colors, maxContentWidth, spacing } from '@/theme';
import { useCountries } from '@/hooks/useCities';
import { useResponsive } from '@/hooks/useResponsive';
import type { Country } from '@/types/geography.types';

export interface CountrySelectFieldProps {
  label: string;
  value: Country | null;
  onSelect: (country: Country) => void;
}

function formatPhoneCode(phoneCode: string): string {
  return phoneCode.startsWith('+') ? phoneCode : `+${phoneCode}`;
}

/** Peu de pays existent (contrairement aux villes) — une simple liste dans une modale suffit, pas besoin de recherche. */
export function CountrySelectField({ label, value, onSelect }: CountrySelectFieldProps) {
  const [isOpen, setOpen] = useState(false);
  const { data: countries } = useCountries();
  const { isTablet } = useResponsive();

  return (
    <View>
      <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
        {label}
      </AppText>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value?.name ?? 'aucun pays choisi'}`}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <View style={[styles.badge, value ? styles.badgeFilled : styles.badgeEmpty]}>
          {value ? (
            <AppText variant="xs" weight="bold" color="primary">
              {value.isoCode.toUpperCase()}
            </AppText>
          ) : (
            <IconWorld size={16} color={colors.textMuted} />
          )}
        </View>
        <AppText variant="base" color={value ? 'textPrimary' : 'textSecondary'} style={styles.fieldText}>
          {value?.name ?? 'Choisir un pays'}
        </AppText>
        <IconChevronDown size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, isTablet && styles.modalCentered]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <AppText variant="lg" weight="semibold">
                Choisir un pays
              </AppText>
              <AppText variant="sm" color="textSecondary">
                {label}
              </AppText>
            </View>
            <IconButton
              icon={<IconX size={18} color={colors.textPrimary} />}
              accessibilityLabel="Fermer"
              onPress={() => setOpen(false)}
            />
          </View>

          <FlatList
            data={countries ?? []}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = value?.id === item.id;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.rowPressed]}
                >
                  <View style={[styles.badge, isSelected ? styles.badgeSelected : styles.badgeFilled]}>
                    <AppText variant="xs" weight="bold" color="primary">
                      {item.isoCode.toUpperCase()}
                    </AppText>
                  </View>
                  <View style={styles.rowText}>
                    <AppText variant="base" weight={isSelected ? 'semibold' : 'medium'}>
                      {item.name}
                    </AppText>
                    <AppText variant="xs" color="textSecondary">
                      {formatPhoneCode(item.phoneCode)}
                    </AppText>
                  </View>
                  {isSelected ? <IconCheck size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.xxs,
  },
  pressed: {
    opacity: 0.7,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
  },
  fieldText: {
    flex: 1,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFilled: {
    backgroundColor: colors.primaryLight,
  },
  badgeSelected: {
    backgroundColor: colors.surface,
  },
  badgeEmpty: {
    backgroundColor: colors.surfaceMuted,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  modalCentered: {
    maxWidth: maxContentWidth.form,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalHeaderText: {
    flex: 1,
    gap: 2,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  rowSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});