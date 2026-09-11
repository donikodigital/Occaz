// mobile/src/components/screens/CountrySelectField.tsx
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react-native';
import { AppText, Card, IconButton } from '@/components/ui';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { useCountries } from '@/hooks/useCities';
import { useResponsive } from '@/hooks/useResponsive';
import type { Country } from '@/types/geography.types';

export interface CountrySelectFieldProps {
  label: string;
  value: Country | null;
  onSelect: (country: Country) => void;
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
      <Card onPress={() => setOpen(true)} style={styles.field}>
        <View style={styles.fieldRow}>
          <AppText variant="base" color={value ? 'textPrimary' : 'textSecondary'} style={{ flex: 1 }}>
            {value?.name ?? 'Choisir un pays'}
          </AppText>
          <IconChevronDown size={16} color={colors.textSecondary} />
        </View>
      </Card>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, isTablet && styles.modalCentered]}>
          <View style={styles.modalHeader}>
            <AppText variant="lg" weight="semibold">
              Choisir un pays
            </AppText>
            <IconButton
              icon={<IconX size={18} color={colors.textPrimary} />}
              accessibilityLabel="Fermer"
              onPress={() => setOpen(false)}
            />
          </View>
          <FlatList
            data={countries ?? []}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                style={styles.row}
              >
                <AppText variant="base" style={{ flex: 1 }}>
                  {item.name}
                </AppText>
                {value?.id === item.id ? <IconCheck size={16} color={colors.primary} /> : null}
              </Pressable>
            )}
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
  field: {
    padding: spacing.sm + 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
