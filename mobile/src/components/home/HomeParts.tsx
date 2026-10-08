// mobile/src/components/home/HomeParts.tsx
//
// [08/10/2026] v1 — Petites briques de l'accueil refondu : barre de recherche en pilule, titre de section avec lien « Voir tout »,
// bouton flottant « + » qui déroule deux raccourcis.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconChevronRight, IconPlus, IconSearch, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

/** Pilule de recherche : n'est pas un champ de saisie, elle ouvre l'écran de recherche (clavier déjà levé). */
export function HomeSearchBar({ placeholder, onPress }: { placeholder: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
    >
      <IconSearch size={20} color={OCEAN.base} />
      <AppText variant="sm" color="textSecondary" numberOfLines={1} style={styles.searchText}>
        {placeholder}
      </AppText>
    </Pressable>
  );
}

/** Titre en capitales (« VOS TRAJETS EN COURS ») avec, si besoin, un lien à droite. */
export function HomeSectionTitle({
  title,
  actionLabel,
  onPressAction,
}: {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <AppText variant="xs" weight="bold" color={OCEAN.deep} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      {actionLabel && onPressAction ? (
        <Pressable onPress={onPressAction} hitSlop={8} accessibilityRole="link" style={styles.sectionAction}>
          <AppText variant="xs" weight="semibold" color={OCEAN.base}>
            {actionLabel}
          </AppText>
          <IconChevronRight size={14} color={OCEAN.base} />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface FabAction {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

/**
 * Bouton rond flottant en bas à droite. À poser dans une vue `flex: 1` qui enveloppe l'écran (il est en position absolue) ; il
 * déroule les raccourcis `actions` au toucher et se referme quand on en choisit un ou qu'on touche à côté.
 */
export function HomeFab({ actions, accessibilityLabel = 'Actions rapides' }: { actions: FabAction[]; accessibilityLabel?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer" /> : null}
      <View style={styles.fabWrap} pointerEvents="box-none">
        {open
          ? actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  setOpen(false);
                  action.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.fabAction, pressed && styles.pressed]}
              >
                <AppText variant="sm" weight="semibold" color={OCEAN.deep}>
                  {action.label}
                </AppText>
                <View style={styles.fabActionIcon}>{action.icon}</View>
              </Pressable>
            ))
          : null}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          {open ? <IconX size={26} color={OCEAN.deep} /> : <IconPlus size={28} color={OCEAN.deep} />}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchText: {
    flex: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    letterSpacing: 1,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,58,99,0.35)',
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: OCEAN.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
