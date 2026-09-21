// mobile/src/components/ocean/OceanKit.tsx
//
// Briques de l'identité « bleu océan » du profil chauffeur, utilisées par
// tous les écrans de l'espace client : même bandeau sombre aux reflets, même
// bouton plein, mêmes sections à en-tête soulignée, mêmes champs clairs.
// Seul le contenu change d'un espace à l'autre, pas le langage visuel.

import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

// ---------------------------------------------------------------------------
// Bandeau
// ---------------------------------------------------------------------------

/** Carte sombre aux reflets bleus — le « bandeau » du profil, réutilisable pour un titre fort. */
export function OceanHeroCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.hero, style]}>
      <View style={styles.heroCircleLarge} />
      <View style={styles.heroCircleSmall} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// En-tête d'écran
// ---------------------------------------------------------------------------

export function OceanScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <IconArrowLeft size={18} color={OCEAN.base} />
      </Pressable>
      <View style={styles.headerText}>
        <AppText variant="lg" weight="bold" color={OCEAN.deep} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------

export type OceanButtonVariant = 'primary' | 'outline' | 'soft' | 'danger';

export function OceanButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: OceanButtonVariant;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = Boolean(disabled || loading);
  const textColor = variant === 'primary' ? OCEAN.onDark : variant === 'danger' ? colors.danger : OCEAN.base;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        BUTTON_VARIANTS[variant],
        isDisabled && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon}
          <AppText variant="base" weight="semibold" color={textColor}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Cartes, sections, champs
// ---------------------------------------------------------------------------

export function OceanCard({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Carte blanche à en-tête « icône dans une pastille · TITRE ———— » (comme « Identité & contact » du profil). */
export function OceanSection({
  icon,
  title,
  action,
  children,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.sectionTitle}>
          {title.toUpperCase()}
        </AppText>
        <View style={styles.sectionLine} />
        {action}
      </View>
      {children}
    </View>
  );
}

/** Champ d'information en lecture seule : petit libellé en capitales, valeur dans une boîte claire. */
export function OceanField({
  label,
  value,
  badge,
  style,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      <AppText variant="xs" weight="bold" color="textMuted" style={styles.fieldLabel}>
        {label.toUpperCase()}
      </AppText>
      <View style={styles.fieldBox}>
        <AppText variant="sm" weight="semibold" style={styles.fieldValue} numberOfLines={3}>
          {value}
        </AppText>
        {badge}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pastilles, puces, interrupteur, stepper
// ---------------------------------------------------------------------------

export type OceanPillTone = 'ocean' | 'success' | 'danger' | 'gold' | 'neutral';

const PILL_TONES: Record<OceanPillTone, { background: string; foreground: string }> = {
  ocean: { background: OCEAN.mist, foreground: OCEAN.base },
  success: { background: colors.successLight, foreground: colors.successDark },
  danger: { background: '#FDE8E8', foreground: colors.danger },
  gold: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
  neutral: { background: colors.surfaceMuted, foreground: colors.textSecondary },
};

export function OceanPill({
  label,
  tone = 'ocean',
  icon,
}: {
  label: string;
  tone?: OceanPillTone;
  icon?: React.ReactNode;
}) {
  const palette = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      {icon}
      <AppText variant="xs" weight="semibold" color={palette.foreground}>
        {label}
      </AppText>
    </View>
  );
}

/** Puce sélectionnable (catégorie, filtre). */
export function OceanChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {icon}
      <AppText variant="sm" weight="semibold" color={active ? OCEAN.onDark : OCEAN.base}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function OceanSwitchRow({
  value,
  onChange,
  label,
  description,
  icon,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [styles.switchRow, value && styles.switchRowActive, pressed && styles.pressed]}
    >
      {icon ? <View style={styles.switchIcon}>{icon}</View> : null}
      <View style={styles.switchText}>
        <AppText variant="sm" weight="semibold">
          {label}
        </AppText>
        {description ? (
          <AppText variant="xs" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

export function OceanStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`Retirer : ${label}`}
        style={[styles.stepperButton, value <= min && styles.buttonDisabled]}
      >
        <IconMinus size={16} color={OCEAN.base} />
      </Pressable>
      <AppText variant="lg" weight="bold" color={OCEAN.deep} style={styles.stepperValue}>
        {value}
      </AppText>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`Ajouter : ${label}`}
        style={[styles.stepperButton, value >= max && styles.buttonDisabled]}
      >
        <IconPlus size={16} color={OCEAN.base} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// États vides
// ---------------------------------------------------------------------------

export function OceanEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <AppText variant="md" weight="semibold" align="center">
        {title}
      </AppText>
      <AppText variant="sm" color="textSecondary" align="center">
        {text}
      </AppText>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS: Record<OceanButtonVariant, ViewStyle> = {
  primary: { backgroundColor: OCEAN.base },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: OCEAN.base },
  soft: { backgroundColor: OCEAN.mist },
  danger: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger },
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },

  hero: {
    backgroundColor: OCEAN.deep,
    borderRadius: 28,
    padding: spacing.md,
    overflow: 'hidden',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroCircleLarge: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(30,155,215,0.28)',
  },
  heroCircleSmall: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(143,211,244,0.14)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerSpacer: {
    width: 40,
  },

  button: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OCEAN.line,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  section: {
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    letterSpacing: 0.9,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: OCEAN.line,
  },

  field: {
    gap: 6,
  },
  fieldLabel: {
    letterSpacing: 0.7,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OCEAN.line,
    backgroundColor: OCEAN.mist,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  fieldValue: {
    flex: 1,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: OCEAN.base,
    borderColor: OCEAN.base,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
  },
  switchRowActive: {
    borderColor: OCEAN.base,
    backgroundColor: OCEAN.mist,
  },
  switchIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchTrackOn: {
    backgroundColor: OCEAN.base,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: OCEAN.onDark,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
    padding: 4,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 34,
    textAlign: 'center',
  },

  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});