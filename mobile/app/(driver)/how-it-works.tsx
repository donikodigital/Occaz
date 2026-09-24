// mobile/app/(driver)/how-it-works.tsx
//
// v1 — « Comment ça marche ? » côté chauffeur : deux onglets (Trajets /
// Envois), chacun avec ses 3 étapes réelles. Même structure que la
// version client, contenu adapté au point de vue du chauffeur.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCash, IconCheck, IconPackage, IconRoute, IconSpeakerphone, IconUpload } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

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
    title: 'Publiez un trajet',
    text: 'Indiquez votre itinéraire, la date et le nombre de places — votre trajet devient visible aux passagers.',
  },
  {
    icon: IconCheck,
    title: 'Acceptez des réservations',
    text: 'Chaque réservation payée réduit vos places disponibles. Le jour J, validez la montée puis la descente avec le code du passager.',
  },
  {
    icon: IconCash,
    title: 'Touchez votre gain',
    text: 'Votre part est créditée sur votre portefeuille dès la prestation validée — retirable à tout moment.',
  },
];

const SHIPMENT_STEPS: Step[] = [
  {
    icon: IconSpeakerphone,
    title: 'Recevez les demandes',
    text: 'Dès qu\'un client publie un envoi, tous les chauffeurs validés sont prévenus — avec ou sans trajet établi.',
  },
  {
    icon: IconPackage,
    title: 'Acceptez en premier',
    text: 'Le premier chauffeur à accepter s\'en charge. Vous voyez immédiatement le gain net qui vous reviendra.',
  },
  {
    icon: IconRoute,
    title: 'Récupérez et livrez',
    text: 'Un code valide la récupération, un autre la livraison. Votre gain net est crédité dès la livraison confirmée.',
  },
];

function Segmented({ value, onChange }: { value: Segment; onChange: (segment: Segment) => void }) {
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
            {segment === 'trips' ? 'Trajets' : 'Envois'}
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
  const [segment, setSegment] = useState<Segment>('trips');
  const steps = segment === 'trips' ? TRIP_STEPS : SHIPMENT_STEPS;

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Comment ça marche ?" onBack={() => router.back()} />

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