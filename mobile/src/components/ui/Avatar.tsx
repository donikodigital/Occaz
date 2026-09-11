// mobile/src/components/ui/Avatar.tsx
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { AppText } from './AppText';

export interface AvatarProps {
  initials: string;
  imageUri?: string | null;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
}

/** Avatar rond — image si disponible, sinon initiales sur fond de couleur. */
export function Avatar({
  initials,
  imageUri,
  size = 40,
  backgroundColor = colors.primary,
  textColor = colors.onPrimary,
}: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: radius.pill };

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={dimension} contentFit="cover" />;
  }

  return (
    <View style={[styles.fallback, dimension, { backgroundColor }]}>
      <AppText variant={size >= 48 ? 'md' : 'sm'} weight="semibold" color={textColor}>
        {initials.slice(0, 2).toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
