// mobile/src/components/safety/ReportUserLink.tsx
// [11/10/2026] v1 — petit lien « Signaler ou bloquer » à poser sous la fiche d'un conducteur, d'un passager ou d'un expéditeur. Ouvre la page de
// signalement de l'espace courant en lui passant la personne visée (profil conducteur ou client) et le contexte (trajet, réservation, envoi).
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconFlag3 } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import type { UserTarget } from '@/types/safety.types';

export interface ReportUserLinkProps {
  /** Espace courant : détermine la page de signalement ouverte. */
  space: 'customer' | 'driver';
  target: Pick<UserTarget, 'driverId' | 'customerId'>;
  name: string;
  tripId?: string;
  bookingId?: string;
  shipmentId?: string;
  label?: string;
}

export function ReportUserLink({ space, target, name, tripId, bookingId, shipmentId, label = 'Signaler ou bloquer' }: ReportUserLinkProps) {
  function open() {
    router.push({
      pathname: space === 'customer' ? '/(customer)/report-user' : '/(driver)/report-user',
      params: {
        ...(target.driverId ? { driverId: target.driverId } : {}),
        ...(target.customerId ? { customerId: target.customerId } : {}),
        name,
        ...(tripId ? { tripId } : {}),
        ...(bookingId ? { bookingId } : {}),
        ...(shipmentId ? { shipmentId } : {}),
      },
    });
  }

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label} : ${name}`} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <IconFlag3 size={15} color={OCEAN.base} />
      <AppText variant="sm" weight="semibold" color={OCEAN.base}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  pressed: { opacity: 0.7 },
});
