// mobile/src/components/screens/SearchHeroHeader.tsx
//
// En-tête « héro » commun aux pages de recherche (ville, point de départ,
// adresse de récupération / de livraison, destination) : bandeau Ocean avec
// une pastille d'icône, un titre, une phrase d'aide, la croix de fermeture et
// — au cœur du bandeau — le champ de recherche. Le champ est donc toujours
// visible et au même endroit, qu'on cherche une ville ou une adresse.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { IconSearch, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanHeroCard } from '@/components/ocean/OceanKit';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export interface SearchHeroHeaderProps {
  /** Icône posée dans la pastille translucide (taille 22, couleur OCEAN.onDark conseillées). */
  icon: React.ReactNode;
  /** Petit repère au-dessus du titre, en bleu ciel. */
  caption: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Le champ de recherche (SearchHeroInput). */
  children?: React.ReactNode;
  /** Replie la zone du champ (sans le démonter) — étape de confirmation d'une adresse. */
  fieldHidden?: boolean;
}

export function SearchHeroHeader({ icon, caption, title, subtitle, onClose, children, fieldHidden }: SearchHeroHeaderProps) {
  return (
    <View style={styles.wrap}>
      <OceanHeroCard style={styles.hero}>
        <View style={styles.topRow}>
          <View style={styles.iconTile}>{icon}</View>
          <View style={styles.texts}>
            <AppText variant="xs" weight="bold" color={OCEAN.sky} style={styles.caption} numberOfLines={1}>
              {caption.toUpperCase()}
            </AppText>
            <AppText variant="xl" weight="bold" color={OCEAN.onDark} numberOfLines={2}>
              {title}
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <IconX size={18} color={OCEAN.onDark} />
          </Pressable>
        </View>

        {subtitle ? (
          <AppText variant="sm" color="rgba(255,255,255,0.82)" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}

        {children ? <View style={[styles.fieldSlot, fieldHidden && styles.fieldSlotHidden]}>{children}</View> : null}
      </OceanHeroCard>
    </View>
  );
}

export interface SearchHeroInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Affiche un indicateur de chargement à la place de la croix d'effacement. */
  loading?: boolean;
}

/**
 * Champ blanc arrondi posé sur le bandeau. Une seule ligne, toujours : le
 * texte d'aide est volontairement court pour ne jamais être coupé.
 */
export function SearchHeroInput({ value, onChangeText, placeholder, autoFocus, loading }: SearchHeroInputProps) {
  const hasValue = value.length > 0;

  return (
    <View style={styles.input}>
      <IconSearch size={18} color={OCEAN.base} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        multiline={false}
        numberOfLines={1}
        style={styles.inputText}
        accessibilityLabel={placeholder}
      />
      {loading ? (
        <ActivityIndicator size="small" color={OCEAN.base} />
      ) : hasValue ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          hitSlop={10}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <IconX size={14} color={OCEAN.base} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  hero: {
    padding: spacing.md,
    borderRadius: 28,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  caption: {
    letterSpacing: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  fieldSlot: {
    marginTop: spacing.md,
  },
  fieldSlotHidden: {
    display: 'none',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inputText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
