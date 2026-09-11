// mobile/src/components/ui/RatingStars.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconStar, IconStarFilled } from '@tabler/icons-react-native';
import { colors } from '@/theme';

export interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  max?: number;
}

/** Sélecteur d'étoiles réutilisable — interactif si `onChange` est fourni, purement d'affichage sinon. */
export function RatingStars({ value, onChange, size = 28, max = 5 }: RatingStarsProps) {
  const isInteractive = Boolean(onChange);

  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const filled = starValue <= value;
        const star = filled ? (
          <IconStarFilled size={size} color={colors.accent} />
        ) : (
          <IconStar size={size} color={colors.border} />
        );

        if (!isInteractive) return <View key={starValue}>{star}</View>;

        return (
          <Pressable
            key={starValue}
            onPress={() => onChange?.(starValue)}
            accessibilityRole="button"
            accessibilityLabel={`${starValue} étoile${starValue > 1 ? 's' : ''}`}
            hitSlop={4}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
});
