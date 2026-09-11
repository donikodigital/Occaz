// mobile/src/components/ui/Divider.tsx
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, spacing } from '@/theme';

/** Ligne de séparation fine — remplace toute bordure "top"/"bottom" improvisée. */
export function Divider({ style, ...rest }: ViewProps) {
  return <View style={[styles.line, style]} {...rest} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
