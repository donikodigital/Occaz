// mobile/src/components/screens/DriverComplianceBanner.tsx
// [19/10/2026] v1 — Bandeau de régularisation du dossier conducteur (accueil conducteur).
// Tant que le compte n'est pas validé, le conducteur peut créer des trajets de passagers pendant la durée de tolérance (réglage
// « driver.pending_grace_days », 7 jours par défaut). Ce bandeau dit combien de jours il reste et quelles pièces manquent ; passé le délai,
// la création de trajets est bloquée jusqu'à l'envoi des pièces. Un dossier COMPLET qui attend l'examen de l'équipe n'est jamais bloqué.
// Les colis restent réservés aux comptes validés.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconChevronRight, IconClockHour4, IconFileCheck } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useDriverCompliance } from '@/hooks/useDriverCompliance';

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

export function DriverComplianceBanner() {
  const { data } = useDriverCompliance();
  if (!data || data.isCompliant) return null;
  // Compte suspendu, bloqué ou désactivé : le bandeau de statut de l'accueil s'en charge.
  if (data.status !== 'PENDING' && data.status !== 'IN_VERIFICATION') return null;

  const missing = joinLabels(data.missingLabels.map((label) => label.toLowerCase()));

  let tone: 'wait' | 'warn' | 'blocked' = 'warn';
  let title: string;
  let text: string;
  if (data.awaitingReview) {
    tone = 'wait';
    title = 'Dossier complet : examen en cours';
    text = "Notre équipe examine vos pièces. En attendant, vous pouvez créer des trajets de passagers. Les colis s'ouvrent après la validation.";
  } else if (data.graceExpired) {
    tone = 'blocked';
    title = 'Création de trajets bloquée';
    text = `Le délai de ${data.graceDays} jour${data.graceDays > 1 ? 's' : ''} est dépassé. Envoyez : ${missing}. Vous pourrez de nouveau créer des trajets dès l'envoi.`;
  } else {
    title = data.daysLeft <= 1 ? 'Dernier jour pour régulariser votre dossier' : `Il vous reste ${data.daysLeft} jours pour régulariser votre dossier`;
    text = `À envoyer : ${missing}. Passé ce délai, la création de trajets sera bloquée. Les colis s'ouvrent après la validation.`;
  }

  const palette =
    tone === 'blocked'
      ? { background: '#FDE8E8', border: '#F5C2C2', foreground: colors.danger }
      : tone === 'wait'
        ? { background: OCEAN.mist, border: OCEAN.line, foreground: OCEAN.deep }
        : { background: OCEAN.goldSoft, border: '#F3DFA6', foreground: OCEAN.goldInk };
  const Icon = tone === 'blocked' ? IconAlertTriangle : tone === 'wait' ? IconFileCheck : IconClockHour4;

  return (
    <Pressable
      onPress={() => router.push('/(driver)/documents')}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.banner, { backgroundColor: palette.background, borderColor: palette.border }, pressed && styles.pressed]}
    >
      <Icon size={20} color={palette.foreground} />
      <View style={styles.text}>
        <AppText variant="sm" weight="bold" color={palette.foreground}>
          {title}
        </AppText>
        <AppText variant="xs" color={palette.foreground}>
          {text}
        </AppText>
        <AppText variant="xs" weight="semibold" color={palette.foreground}>
          {data.awaitingReview ? 'Voir mon dossier' : 'Compléter mon dossier'}
        </AppText>
      </View>
      <IconChevronRight size={16} color={palette.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.8 },
});
