// mobile/src/components/ui/AppText.tsx
import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, lineHeight, ColorToken } from '@/theme';

export type TextVariant = 'display' | 'xxl' | 'xl' | 'lg' | 'md' | 'base' | 'sm' | 'xs';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface AppTextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  /** Jeton de couleur du thème (ex: "textSecondary") ou couleur littérale (ex: "#FFFFFF"). */
  color?: ColorToken | string;
  align?: 'left' | 'center' | 'right';
  children?: React.ReactNode;
}

/**
 * Composant Text unique pour toute l'app — garantit que chaque texte
 * utilise Inter et une taille/couleur du thème plutôt qu'une valeur
 * improvisée à chaque écran.
 */
export function AppText({
  variant = 'base',
  weight = 'regular',
  color = 'textPrimary',
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const resolvedColor = (colors as Record<string, string>)[color] ?? color;

  return (
    <RNText
      style={[
        styles.base,
        {
          fontFamily: fontFamily[weight],
          fontSize: fontSize[variant],
          lineHeight: lineHeight[variant],
          color: resolvedColor,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamily.regular,
  },
});
