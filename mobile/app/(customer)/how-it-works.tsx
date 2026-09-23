// mobile/app/(customer)/how-it-works.tsx
//
// v1 — « Comment ça marche ? » : deux onglets (Trajets / Envois), chacun
// avec ses 3 étapes réelles (celles effectivement codées côté serveur —
// pas un texte marketing générique). Contenu à ajuster librement, c'est
// un texte explicatif, pas un document légal.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCreditCard, IconMapPin, IconPackage, IconRoute, IconSearch, IconTruckDelivery } from '@tabler/icons-react-native';
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
    icon: IconSearch,
    title: 'Recherchez un trajet',
    text: 'Indiquez votre ville de départ, votre destination et la date : vous voyez tous les trajets publiés qui correspondent.',
  },
  {
    icon: IconCreditCard,
    title: 'Réservez et payez',
    text: "Choisissez le nombre de places, payez en une seule fois — votre place n'est confirmée qu'une fois le paiement validé.",
  },
  {
    icon: IconRoute,
    title: 'Voyagez',
    text: "Le jour J, un code vous est envoyé : donnez-le au chauffeur pour valider votre montée, puis votre descente à l'arrivée.",
  },
];

const SHIPMENT_STEPS: Step[] = [
  {
    icon: IconPackage,
    title: 'Décrivez votre colis',
    text: 'Poids, dimensions, catégorie et la période pendant laquelle il peut partir — le prix est calculé automatiquement.',
  },
  {
    icon: IconTruckDelivery,
    title: 'Un chauffeur accepte',
    text: "Tous les chauffeurs validés sont prévenus en même temps, avec ou sans trajet établi. Le premier à accepter s'en charge.",
  },
  {
    icon: IconMapPin,
    title: "Suivi jusqu'à la livraison",
    text: 'Un code valide la récupération, un autre la livraison. Sans chauffeur avant la fin de la période, vous êtes remboursé à 100 %.',
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

export default function HowItWorksScreen() {
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