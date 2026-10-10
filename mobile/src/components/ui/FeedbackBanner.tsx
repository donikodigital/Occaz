// mobile/src/components/ui/FeedbackBanner.tsx
// [10/10/2026] v1 — Message d'erreur, de réussite ou d'information affiché DANS la page. Remplace Alert.alert(), qui ne fait rien sur
// le web (react-native-web ne l'implémente pas) : l'utilisateur ne voyait aucun retour. Un appui sur le bandeau le ferme.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react-native';
import { AppText } from './AppText';
import { colors, radius, spacing } from '@/theme';

export type FeedbackTone = 'error' | 'success' | 'info';

export interface FeedbackBannerProps {
  tone?: FeedbackTone;
  title?: string;
  text: string;
  /** Si fourni, un appui sur le bandeau le ferme. */
  onDismiss?: () => void;
}

const PALETTE: Record<FeedbackTone, { background: string; border: string; foreground: string }> = {
  error: { background: '#FDE8E8', border: '#F5C2C2', foreground: colors.danger },
  success: { background: colors.successLight, border: '#B7E4D3', foreground: colors.successDark },
  info: { background: '#EAF5FB', border: '#CFE4F2', foreground: '#083A63' },
};

export function FeedbackBanner({ tone = 'error', title, text, onDismiss }: FeedbackBannerProps) {
  const palette = PALETTE[tone];
  const Icon = tone === 'error' ? IconAlertTriangle : tone === 'success' ? IconCircleCheck : IconInfoCircle;

  return (
    <Pressable
      accessibilityRole="alert"
      onPress={onDismiss}
      disabled={!onDismiss}
      style={[styles.banner, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <Icon size={18} color={palette.foreground} />
      <View style={styles.text}>
        {title ? (
          <AppText variant="sm" weight="bold" color={palette.foreground}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="xs" color={palette.foreground}>
          {text}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
