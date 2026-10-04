// mobile/src/components/screens/FormAccordion.tsx
//
// Briques d'un long formulaire qui ne montre que ce qui sert sur le moment :
//
//  - FormAccordionSection : une étape du formulaire. Repliée, elle tient sur une ligne (pastille d'état, titre, résumé de ce
//    qui est déjà saisi) ; dépliée, elle montre ses champs. Pastille : numéro (à faire), coche verte (complète), alerte rouge
//    (à corriger).
//  - Disclosure : un détail secondaire repliable à l'intérieur d'une étape (« Mes informations », « Plus de détails »…), avec
//    un aperçu en face du libellé quand il est replié.
//  - StepProgress : barre segmentée « 2 sur 4 étapes ».
//
// Les ouvertures et fermetures sont animées (LayoutAnimation). Rien ici ne connaît le formulaire d'envoi : tout est piloté par
// les props, pour servir aussi à la réservation d'un trajet ou à la création d'un trajet.
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { IconAlertTriangle, IconCheck, IconChevronDown } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

// Android : l'animation de mise en page doit être activée une fois.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Sans effet sur une version qui l'active déjà : l'ouverture se fait simplement sans animation.
  }
}

/** À appeler juste avant de changer l'état d'ouverture : le changement de hauteur suivant s'anime. */
export function animateNextLayout(): void {
  LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

export type StepStatus = 'todo' | 'done' | 'error';

export function FormAccordionSection({
  step,
  icon,
  title,
  summary,
  status,
  expanded,
  onToggle,
  children,
}: {
  /** Numéro affiché dans la pastille tant que l'étape n'est pas complète. */
  step: number;
  icon: React.ReactNode;
  title: string;
  /** Ce qui est déjà saisi, en une ligne, visible quand l'étape est repliée. */
  summary?: string | null;
  status: StepStatus;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, status === 'error' && styles.cardError, expanded && styles.cardExpanded]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}${status === 'done' ? ', complète' : status === 'error' ? ', à corriger' : ''}`}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={[styles.badge, status === 'done' && styles.badgeDone, status === 'error' && styles.badgeError]}>
          {status === 'done' ? (
            <IconCheck size={17} color={colors.successDark} />
          ) : status === 'error' ? (
            <IconAlertTriangle size={17} color={colors.danger} />
          ) : (
            <AppText variant="sm" weight="bold" color={OCEAN.base}>
              {step}
            </AppText>
          )}
        </View>

        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>{icon}</View>
            <AppText variant="base" weight="semibold" numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
          </View>
          {!expanded && summary ? (
            <AppText variant="xs" color={status === 'error' ? 'danger' : 'textSecondary'} numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.chevron, expanded && styles.chevronOpen]}>
          <IconChevronDown size={18} color={OCEAN.base} />
        </View>
      </Pressable>

      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

/**
 * Détail secondaire repliable (dans une étape ou sous le formulaire). `preview` s'affiche en face du libellé tant qu'il est
 * replié ; `keepMounted` garde le contenu monté même replié (un champ qui porte un état interne, comme le code promo).
 */
export function Disclosure({
  icon,
  label,
  preview,
  defaultExpanded = false,
  keepMounted = false,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  preview?: string | null;
  defaultExpanded?: boolean;
  keepMounted?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function toggle() {
    animateNextLayout();
    setExpanded((value) => !value);
  }

  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label}${preview ? `, ${preview}` : ''}`}
        style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
      >
        {icon ? <View style={styles.disclosureIcon}>{icon}</View> : null}
        <View style={styles.disclosureText}>
          <AppText variant="sm" weight="semibold" color={OCEAN.base} numberOfLines={1}>
            {label}
          </AppText>
          {!expanded && preview ? (
            <AppText variant="xs" color="textSecondary" numberOfLines={1}>
              {preview}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.chevron, expanded && styles.chevronOpen]}>
          <IconChevronDown size={16} color={OCEAN.base} />
        </View>
      </Pressable>

      {keepMounted ? (
        <View style={[styles.disclosureBody, !expanded && styles.hidden]}>{children}</View>
      ) : expanded ? (
        <View style={styles.disclosureBody}>{children}</View>
      ) : null}
    </View>
  );
}

/** Barre segmentée : un segment par étape, plein quand l'étape est complète. */
export function StepProgress({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
      <View style={styles.progressBars}>
        {Array.from({ length: total }).map((_, index) => (
          <View key={index} style={[styles.progressBar, index < done && styles.progressBarDone]} />
        ))}
      </View>
      <AppText variant="xs" weight="semibold" color={done === total ? colors.successDark : 'textSecondary'}>
        {done === total ? 'Tout est prêt' : `${done} sur ${total} étapes complètes`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  hidden: {
    display: 'none',
  },

  // Étape
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OCEAN.line,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardExpanded: {
    borderColor: OCEAN.sky,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardError: {
    borderColor: colors.danger,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  badgeDone: {
    backgroundColor: colors.successLight,
  },
  badgeError: {
    backgroundColor: '#FDECEC',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleIcon: {
    opacity: 0.9,
  },
  title: {
    flexShrink: 1,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
    paddingTop: spacing.md,
  },

  // Détail repliable
  disclosure: {
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
    overflow: 'hidden',
  },
  disclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  disclosureIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disclosureText: {
    flex: 1,
    gap: 1,
  },
  disclosureBody: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  // Progression
  progress: {
    gap: 6,
    marginBottom: spacing.md,
  },
  progressBars: {
    flexDirection: 'row',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: OCEAN.line,
  },
  progressBarDone: {
    backgroundColor: OCEAN.base,
  },
});
