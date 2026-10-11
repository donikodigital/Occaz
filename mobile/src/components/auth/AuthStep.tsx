// mobile/src/components/auth/AuthStep.tsx
// [11/10/2026] v1 — Coquille commune des écrans d'inscription, de connexion et de mot de passe oublié : retour, illustration à étincelles,
// titre, sous-titre, repère « Étape x sur y », contenu qui défile, et bouton d'action fixé en bas. Un seul endroit pour l'habillage Ocean.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer } from '@/components/ui';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export interface AuthStepProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Sans `onBack`, aucun bouton retour n'est affiché (ex. définition du mot de passe, qu'on ne peut pas quitter). */
  onBack?: () => void;
  step?: { current: number; total: number; label?: string };
  /** Bouton(s) d'action, fixé(s) en bas de l'écran. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function AuthStep({ icon, title, subtitle, onBack, step, footer, children }: AuthStepProps) {
  return (
    <ScreenContainer scroll maxWidth="form" footer={footer}>
      <View style={styles.header}>
        {onBack ? (
          <IconButton icon={<IconArrowLeft size={18} color={colors.textPrimary} />} accessibilityLabel="Retour" onPress={onBack} />
        ) : (
          <View style={styles.headerSpace} />
        )}
        {step ? (
          <View style={styles.stepper} accessibilityLabel={`Étape ${step.current} sur ${step.total}`}>
            {Array.from({ length: step.total }).map((_, index) => (
              <View key={index} style={[styles.dot, index < step.current && styles.dotDone]} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <AuthIllustration icon={icon} size={96} style={styles.illustration} />

        {step?.label ? (
          <AppText variant="xs" weight="semibold" color={OCEAN.base} align="center" style={styles.stepLabel}>
            {`Étape ${step.current} sur ${step.total} · ${step.label}`}
          </AppText>
        ) : null}
        <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}

        {children}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, minHeight: 48 },
  headerSpace: { width: 40, height: 40 },
  stepper: { flexDirection: 'row', gap: 6, paddingRight: spacing.xs },
  dot: { width: 22, height: 5, borderRadius: 3, backgroundColor: OCEAN.line },
  dotDone: { backgroundColor: OCEAN.base },
  body: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  illustration: { alignSelf: 'center' },
  stepLabel: { marginTop: spacing.md },
  title: { marginTop: spacing.sm, marginBottom: spacing.xxs },
  subtitle: { marginBottom: spacing.lg, alignSelf: 'stretch' },
});
