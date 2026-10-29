// mobile/src/components/auth/LanguageSelector.tsx
// [29/10/2026] v2 — Prop `compact` : pastille réduite (drapeau + code de langue + flèche), sans marge, pour se poser en haut à droite d'un écran.
// [28/10/2026] v1 — Choix de la langue (Français / English UK / Português PT) depuis la page de connexion : une pastille avec le drapeau
// de la langue courante, qui ouvre la liste des langues (même habillage que la liste des pays). Le choix est mémorisé sur l'appareil et
// s'applique tout de suite à tout l'écran.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react-native';
import { AppText, IconButton } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useResponsive } from '@/hooks/useResponsive';
import { flagEmoji } from '@/utils/phone';
import { LANGUAGE_OPTIONS, useLanguageStore, useT } from '@/i18n';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { isTablet } = useResponsive();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);

  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <View style={compact ? undefined : styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('Langue')} : ${current.label}`}
        style={({ pressed }) => [styles.pill, compact && styles.pillCompact, pressed && styles.pressed]}
      >
        <AppText variant={compact ? 'base' : 'lg'}>{flagEmoji(current.flagIso)}</AppText>
        <AppText variant="sm" weight="semibold" color={OCEAN.deep}>
          {compact ? current.code.slice(0, 2).toUpperCase() : current.label}
        </AppText>
        <IconChevronDown size={compact ? 12 : 14} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, isTablet && styles.modalCentered]}>
          <View style={styles.modalHeader}>
            <AppText variant="lg" weight="semibold" style={styles.modalTitle}>
              {t('Choisir la langue')}
            </AppText>
            <IconButton icon={<IconX size={18} color={colors.textPrimary} />} accessibilityLabel={t('Fermer')} onPress={() => setOpen(false)} />
          </View>
          <View style={styles.list}>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === language;
              return (
                <Pressable
                  key={option.code}
                  onPress={() => {
                    setLanguage(option.code);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
                >
                  <AppText variant="xl">{flagEmoji(option.flagIso)}</AppText>
                  <AppText variant="base" weight={selected ? 'semibold' : 'medium'} style={styles.rowName}>
                    {option.label}
                  </AppText>
                  {selected ? <IconCheck size={18} color={OCEAN.base} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillCompact: { minHeight: 32, paddingHorizontal: spacing.sm, gap: 4, borderRadius: radius.md },
  pressed: { opacity: 0.8 },
  modal: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl },
  modalCentered: { maxWidth: 520, alignSelf: 'center', width: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { flex: 1 },
  list: { gap: spacing.xs },
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
