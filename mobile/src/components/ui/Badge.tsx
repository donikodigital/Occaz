// mobile/src/components/ui/Badge.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export type BadgeTone = 'primary' | 'success' | 'accent' | 'danger' | 'neutral';

const TONE_STYLES: Record<BadgeTone, { background: string; text: string }> = {
  primary: { background: colors.primaryLight, text: colors.primaryDark },
  success: { background: colors.successLight, text: colors.successDark },
  accent: { background: colors.accentLight, text: colors.accentDark },
  danger: { background: colors.dangerLight, text: colors.dangerDark },
  neutral: { background: colors.surfaceMuted, text: colors.textSecondary },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
}

/** Petite pastille pour un statut ou une catégorie (ex: "Vérifié", "En attente"). */
export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <View style={[styles.base, { backgroundColor: toneStyle.background }]}>
      {icon}
      <AppText variant="xs" weight="semibold" color={toneStyle.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
  },
});
