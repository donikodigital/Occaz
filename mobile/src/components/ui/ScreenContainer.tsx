// mobile/src/components/ui/ScreenContainer.tsx
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, maxContentWidth, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  /**
   * Largeur max du contenu à partir du seuil tablette — 'form' pour un
   * écran d'authentification ou un formulaire court, 'detail' pour une
   * fiche, 'content' (défaut) pour un écran standard, 'wide' pour une
   * liste ou un tableau de bord qui profite de plus d'espace. Sans
   * effet sur mobile natif (voir useResponsive).
   */
  maxWidth?: keyof typeof maxContentWidth;
  /**
   * Barre fixe en bas, hors défilement — un seul endroit pour ce
   * pattern plutôt que de recomposer SafeAreaView+ScrollView+View à la
   * main dans chaque écran qui en a besoin (ex: un bouton "Réserver"
   * qui reste visible pendant qu'on parcourt le détail d'un trajet).
   */
  footer?: React.ReactNode;
}

/**
 * Coquille commune à tout écran : fond de l'app, zone sûre, clavier géré,
 * et centrage à largeur maximale au-delà du seuil tablette. Un seul
 * endroit pour changer ce comportement pour toute l'application plutôt
 * que de le répéter écran par écran.
 */
export function ScreenContainer({
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  maxWidth = 'content',
  footer,
  style,
  children,
  ...rest
}: ScreenContainerProps) {
  const { isTablet } = useResponsive();
  const widthConstraint = isTablet ? { maxWidth: maxContentWidth[maxWidth], alignSelf: 'center' as const } : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.flex, widthConstraint, styles.fullWidth]}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={[padded && styles.padded, style]}
              keyboardShouldPersistTaps="handled"
              {...rest}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.flex, padded && styles.padded, style]} {...rest}>
              {children}
            </View>
          )}
        </View>
        {footer ? (
          <View style={styles.footerOuter}>
            <View style={[widthConstraint, styles.fullWidth]}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  footerOuter: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
