// mobile/app/(driver)/how-it-works.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [07/10/2026] Le titre de la page passe en bandeau (hero) bleu océan : OceanHeroHeader. Le reste de l'écran est inchangé.
//
// v1 — « Comment ça marche ? » côté conducteur : deux onglets (Trajets /
// Envois), chacun avec ses 3 étapes réelles. Même structure que la
// version client, contenu adapté au point de vue du conducteur.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCash, IconCheck, IconInfoCircle, IconPackage, IconRoute, IconSpeakerphone, IconUpload } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT, translate } from '@/i18n';

type Segment = 'trips' | 'shipments';
type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface Step {
  icon: IconComponent;
  title: string;
  text: string;
}

const TRIP_STEPS: Step[] = [
  {
    icon: IconUpload,
    get title() { return translate('Publiez un trajet'); },
    get text() { return translate('Indiquez votre itinéraire, la date et le nombre de places — votre trajet devient visible aux passagers.'); },
  },
  {
    icon: IconCheck,
    get title() { return translate('Acceptez des réservations'); },
    get text() { return translate('Chaque réservation payée réduit vos places disponibles. Le jour J, validez la montée puis la descente avec le code du passager.'); },
  },
  {
    icon: IconCash,
    get title() { return translate('Touchez votre gain'); },
    get text() { return translate('Votre part est créditée sur votre portefeuille dès la prestation validée — retirable à tout moment.'); },
  },
];

const SHIPMENT_STEPS: Step[] = [
  {
    icon: IconSpeakerphone,
    get title() { return translate('Recevez les demandes'); },
    get text() { return translate("Dès qu'un client publie un envoi, tous les conducteurs validés sont prévenus — avec ou sans trajet établi."); },
  },
  {
    icon: IconPackage,
    get title() { return translate('Acceptez en premier'); },
    get text() { return translate("Le premier conducteur à accepter s'en charge. Vous voyez immédiatement le gain net qui vous reviendra."); },
  },
  {
    icon: IconRoute,
    get title() { return translate('Récupérez et livrez'); },
    get text() { return translate('Un code valide la récupération, un autre la livraison. Votre gain net est crédité dès la livraison confirmée.'); },
  },
];

function Segmented({ value, onChange }: { value: Segment; onChange: (segment: Segment) => void }) {
  const t = useT();
  return (
    <View style={styles.segmented}>
      {(['trips', 'shipments'] as const).map((segment) => {
        const isActive = segment === value;
        return (
          <AppText
            key={segment}
            onPress={() => onChange(segment)}
            variant="sm"
            weight="bold"
            color={isActive ? OCEAN.onDark : OCEAN.base}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            {segment === 'trips' ? t('Trajets') : t('Envois')}
          </AppText>
        );
      })}
    </View>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <OceanCard style={styles.stepCard}>
      <View style={styles.stepBadge}>
        <AppText variant="sm" weight="bold" color={OCEAN.onDark}>
          {index + 1}
        </AppText>
      </View>
      <View style={styles.stepIcon}>
        <Icon size={18} color={OCEAN.base} />
      </View>
      <View style={styles.stepText}>
        <AppText variant="sm" weight="semibold">
          {step.title}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {step.text}
        </AppText>
      </View>
    </OceanCard>
  );
}

export default function DriverHowItWorksScreen() {
  const t = useT();
  const [segment, setSegment] = useState<Segment>('trips');
  const steps = segment === 'trips' ? TRIP_STEPS : SHIPMENT_STEPS;

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t('Comment ça marche ?')} icon={<IconInfoCircle />} onBack={() => router.back()} />

      <Segmented value={segment} onChange={setSegment} />

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <StepCard key={step.title} step={step} index={index} />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segmentActive: {
    backgroundColor: OCEAN.base,
  },
  steps: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepCard: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: OCEAN.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
});