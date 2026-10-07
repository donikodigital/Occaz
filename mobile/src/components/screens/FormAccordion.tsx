// mobile/src/components/screens/FormAccordion.tsx
//
// [07/10/2026] v2 — Le titre de chaque étape devient un « hero » : bandeau bleu océan avec une grosse icône dans une tuile, la
// pastille d'état (numéro / coche / alerte) en badge sur l'icône, « ÉTAPE 2 SUR 4 » au-dessus du titre et le résumé dessous. Replié,
// le bandeau est clair ; ouvert, il passe au bleu profond aux reflets. Même bandeau (StepHero) pour la recherche de trajets, qui
// n'a pas d'accordéon : voir HeroSection.
//
// Briques d'un long formulaire qui ne montre que ce qui sert sur le moment :
//
//  - StepHero : le bandeau de titre d'une étape (utilisé par les deux composants ci-dessous).
//  - FormAccordionSection : une étape du formulaire. Repliée, elle tient sur un bandeau (titre + résumé de ce qui est déjà saisi) ;
//    dépliée, elle montre ses champs sous un bandeau profond.
//  - HeroSection : une étape toujours ouverte (pas d'accordéon), avec le même bandeau.
//  - Disclosure : un détail secondaire repliable à l'intérieur d'une étape (« Mes informations », « Plus de détails »…), avec
//    un aperçu en face du libellé quand il est replié.
//  - StepProgress : barre segmentée « 2 sur 4 étapes ».
//
// Les ouvertures et fermetures sont animées (LayoutAnimation). Rien ici ne connaît le formulaire d'envoi : tout est piloté par
// les props, pour servir aussi à la réservation d'un trajet ou à la création d'un trajet.
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleProp, StyleSheet, UIManager, View, ViewStyle } from 'react-native';
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

/** `deep` : bleu profond aux reflets (étape ouverte). `soft` : bandeau clair (étape repliée). */
export type StepHeroTone = 'deep' | 'soft';

const ERROR_ON_DEEP = '#FFC9C9';

/** Les icônes passées par les écrans ont chacune leur couleur : le bandeau les remet à la sienne, et à sa taille. */
function tintIcon(icon: React.ReactNode, color: string): React.ReactNode {
  if (!React.isValidElement(icon)) return icon;
  return React.cloneElement(icon as React.ReactElement<{ color?: string; size?: number }>, { color, size: 22 });
}

export function StepHero({
  tone,
  step,
  total,
  icon,
  title,
  summary,
  status,
  chevron,
}: {
  tone: StepHeroTone;
  /** Numéro affiché dans le badge tant que l'étape n'est pas complète. */
  step: number;
  /** Nombre d'étapes : sert au « ÉTAPE 2 SUR 4 » au-dessus du titre (omis : pas de ligne au-dessus). */
  total?: number;
  icon: React.ReactNode;
  title: string;
  summary?: string | null;
  status: StepStatus;
  /** Présent : affiche le chevron d'ouverture (`open` = étape ouverte). Absent : étape non repliable. */
  chevron?: { open: boolean };
}) {
  const deep = tone === 'deep';
  const summaryColor = status === 'error' ? (deep ? ERROR_ON_DEEP : colors.danger) : deep ? OCEAN.sky : colors.textSecondary;

  return (
    <View style={[styles.hero, deep ? styles.heroDeep : styles.heroSoft]}>
      <View style={[styles.heroCircleLarge, deep ? styles.circleOnDeep : styles.circleOnSoft]} />
      <View style={[styles.heroCircleSmall, deep ? styles.circleOnDeep : styles.circleOnSoft]} />

      <View style={styles.tileWrap}>
        <View style={[styles.tile, deep ? styles.tileDeep : styles.tileSoft]}>{tintIcon(icon, deep ? OCEAN.onDark : OCEAN.base)}</View>
        <View
          style={[
            styles.statusBadge,
            { borderColor: deep ? OCEAN.deep : OCEAN.mist },
            status === 'todo' && (deep ? styles.statusTodoDeep : styles.statusTodoSoft),
            status === 'done' && styles.statusDone,
            status === 'error' && styles.statusError,
          ]}
        >
          {status === 'done' ? (
            <IconCheck size={12} color={colors.onPrimary} strokeWidth={3} />
          ) : status === 'error' ? (
            <IconAlertTriangle size={12} color={colors.onPrimary} />
          ) : (
            <AppText variant="xs" weight="bold" color={deep ? OCEAN.deep : OCEAN.onDark} style={styles.statusNumber}>
              {step}
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.heroText}>
        {total ? (
          <AppText variant="xs" weight="bold" color={deep ? OCEAN.gold : OCEAN.bright} style={styles.eyebrow}>
            {`ÉTAPE ${step} SUR ${total}`}
          </AppText>
        ) : null}
        <AppText variant="md" weight="bold" color={deep ? OCEAN.onDark : OCEAN.deep} numberOfLines={1}>
          {title}
        </AppText>
        {summary ? (
          <AppText variant="xs" color={summaryColor} numberOfLines={1}>
            {summary}
          </AppText>
        ) : null}
      </View>

      {chevron ? (
        <View style={[styles.heroChevron, deep ? styles.heroChevronDeep : styles.heroChevronSoft, chevron.open && styles.chevronOpen]}>
          <IconChevronDown size={18} color={deep ? OCEAN.onDark : OCEAN.base} />
        </View>
      ) : null}
    </View>
  );
}

export function FormAccordionSection({
  step,
  total,
  icon,
  title,
  summary,
  status,
  expanded,
  onToggle,
  children,
}: {
  /** Numéro affiché dans le badge tant que l'étape n'est pas complète. */
  step: number;
  /** Nombre d'étapes du formulaire : affiche « ÉTAPE 2 SUR 4 » au-dessus du titre. */
  total?: number;
  icon: React.ReactNode;
  title: string;
  /** Ce qui est déjà saisi, en une ligne, sous le titre. */
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
        style={({ pressed }) => pressed && styles.pressed}
      >
        <StepHero
          tone={expanded ? 'deep' : 'soft'}
          step={step}
          total={total}
          icon={icon}
          title={title}
          summary={summary}
          status={status}
          chevron={{ open: expanded }}
        />
      </Pressable>

      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

/** Une étape toujours ouverte (écran sans accordéon, comme la recherche de trajets) sous le même bandeau. */
export function HeroSection({
  step,
  total,
  icon,
  title,
  summary,
  status = 'todo',
  style,
  children,
}: {
  step: number;
  total?: number;
  icon: React.ReactNode;
  title: string;
  summary?: string | null;
  status?: StepStatus;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, styles.cardExpanded, style]}>
      <StepHero tone="deep" step={step} total={total} icon={icon} title={title} summary={summary} status={status} />
      <View style={styles.body}>{children}</View>
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
    opacity: 0.8,
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
    shadowOpacity: 0.12,
    elevation: 3,
  },
  cardError: {
    borderColor: colors.danger,
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Bandeau (hero) d'une étape
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  heroDeep: {
    backgroundColor: OCEAN.deep,
  },
  heroSoft: {
    backgroundColor: OCEAN.mist,
  },
  heroCircleLarge: {
    position: 'absolute',
    top: -46,
    right: -26,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  heroCircleSmall: {
    position: 'absolute',
    bottom: -34,
    left: 70,
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  circleOnDeep: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleOnSoft: {
    backgroundColor: 'rgba(11,107,168,0.07)',
  },
  tileWrap: {
    width: 48,
    height: 48,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDeep: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tileSoft: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
  },
  statusBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTodoDeep: {
    backgroundColor: OCEAN.gold,
  },
  statusTodoSoft: {
    backgroundColor: OCEAN.base,
  },
  statusDone: {
    backgroundColor: colors.success,
  },
  statusError: {
    backgroundColor: colors.danger,
  },
  statusNumber: {
    fontSize: 11,
    lineHeight: 14,
  },
  heroText: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    letterSpacing: 0.8,
  },
  heroChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChevronDeep: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroChevronSoft: {
    backgroundColor: colors.surface,
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