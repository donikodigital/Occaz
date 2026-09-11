// mobile/src/components/ui/ScreenContainer.tsx
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

export interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
}

/**
 * Coquille commune à tout écran : fond de l'app, zone sûre, clavier géré.
 * Un seul endroit pour changer la couleur de fond ou le comportement de
 * défilement de toute l'application.
 */
export function ScreenContainer({
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  style,
  children,
  ...rest
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
