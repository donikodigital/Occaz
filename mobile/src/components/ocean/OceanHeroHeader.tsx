// mobile/src/components/ocean/OceanHeroHeader.tsx
//
// [10/10/2026] v2 — `onClose` (croix « Fermer » qui remplace la flèche, pour les pages affichées juste après une création) et `right`
// (actions à droite, à la place de la tuile d'icône : sélection, « Tout lire »…) : mêmes props qu'OceanScreenHeader, pour que toutes
// les pages puissent passer au bandeau. Les pages qui l'utilisent déjà ne changent pas.
//
// [07/10/2026] v1 — En-tête d'écran en bandeau (hero) bleu océan : le bouton Retour, le titre, un sous-titre facultatif et une grosse
// icône dans une tuile, le tout sur le fond sombre aux reflets d'OceanHeroCard. C'est la version « bandeau » d'OceanScreenHeader
// (mêmes props, plus `icon`) ; seul le titre est concerné, le reste de l'écran ne change pas.
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { IconArrowLeft, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { OceanHeroCard } from './OceanKit';

export function OceanHeroHeader({
  title,
  subtitle,
  onBack,
  onClose,
  icon,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Page affichée juste après une création : une croix qui ferme (et revient à l'accueil) au lieu de la flèche vers les étapes d'avant. */
  onClose?: () => void;
  /** Icône de la page, affichée à droite dans une tuile (la couleur et la taille sont celles du bandeau). */
  icon?: React.ReactElement<{ color?: string; size?: number }>;
  /** Actions à droite ; remplacent la tuile d'icône quand elles sont fournies. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <OceanHeroCard style={[styles.card, style]}>
      <View style={styles.row}>
        <Pressable
          onPress={onClose ?? onBack}
          accessibilityRole="button"
          accessibilityLabel={onClose ? 'Fermer et revenir à l’accueil' : 'Retour'}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          {onClose ? <IconX size={20} color={OCEAN.onDark} /> : <IconArrowLeft size={20} color={OCEAN.onDark} />}
        </Pressable>

        <View style={styles.text}>
          <AppText variant="xl" weight="bold" color={OCEAN.onDark} numberOfLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="xs" color={OCEAN.sky} numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {right ? (
          right
        ) : icon ? (
          <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {React.cloneElement(icon, { color: OCEAN.onDark, size: 24 })}
          </View>
        ) : null}
      </View>
    </OceanHeroCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  tile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
