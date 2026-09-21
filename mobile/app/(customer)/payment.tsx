// mobile/app/(customer)/payment.tsx
//
// v2 — Habillage bleu océan ; logique inchangée. Le montant à payer occupe
// un bandeau sombre, les moyens de paiement sont des cartes avec un
// indicateur de choix, et « Payer » reprend le bouton plein du profil.

import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconCheck, IconCreditCard, IconShieldLock } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanHeroCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useActivePaymentProviders, useInitiatePayment } from '@/hooks/usePayments';
import { useBooking } from '@/hooks/useBookings';
import { useShipment } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { PaymentProvider } from '@/types/payments.types';

const PROVIDER_LABELS: Record<PaymentProvider['type'], string> = {
  ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY_XOF: 'Mobile Money',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  OTHER: 'Autre',
};

export default function PaymentScreen() {
  const { bookingId, shipmentId } = useLocalSearchParams<{ bookingId?: string; shipmentId?: string }>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const bookingQuery = useBooking(bookingId);
  const shipmentQuery = useShipment(shipmentId);
  const { data: providers, isLoading: providersLoading } = useActivePaymentProviders();
  const initiatePayment = useInitiatePayment();

  const totalAmount = bookingId ? bookingQuery.data?.totalAmount : shipmentQuery.data?.totalAmount;
  const isLoadingAmount = bookingId ? bookingQuery.isLoading : shipmentQuery.isLoading;

  function handlePay() {
    if (!selectedProviderId) return;
    setErrorMessage(undefined);

    initiatePayment.mutate(
      { bookingId, shipmentId, providerId: selectedProviderId },
      {
        onSuccess: () => {
          Alert.alert('Paiement confirmé', 'Votre paiement a bien été pris en compte.', [
            {
              text: 'OK',
              onPress: () =>
                router.replace(
                  bookingId ? `/(customer)/booking/${bookingId}` : `/(customer)/shipment/${shipmentId}`,
                ),
            },
          ]);
        },
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader title="Paiement" subtitle="Choisissez comment payer" onBack={() => router.back()} />

      <OceanHeroCard style={styles.amountHero}>
        <AppText variant="sm" color={OCEAN.sky}>
          Montant à payer
        </AppText>
        <AppText variant="display" weight="bold" color={OCEAN.onDark}>
          {isLoadingAmount ? '…' : formatMoney(totalAmount ?? '0')}
        </AppText>
        <View style={styles.secure}>
          <IconShieldLock size={14} color={OCEAN.gold} />
          <AppText variant="xs" color={OCEAN.sky}>
            Paiement sécurisé, traité par votre prestataire de paiement.
          </AppText>
        </View>
      </OceanHeroCard>

      <AppText variant="md" weight="bold" color={OCEAN.deep} style={styles.sectionTitle}>
        Moyen de paiement
      </AppText>

      {providersLoading ? (
        <ActivityIndicator color={OCEAN.base} style={styles.loader} />
      ) : !providers || providers.length === 0 ? (
        <OceanCard>
          <OceanEmpty
            icon={<IconCreditCard size={28} color={OCEAN.base} />}
            title="Aucun moyen de paiement"
            text="Aucun moyen de paiement n'est disponible pour le moment. Contactez le support."
          />
        </OceanCard>
      ) : (
        <View style={styles.providerList}>
          {providers.map((provider) => {
            const isSelected = provider.id === selectedProviderId;
            return (
              <OceanCard
                key={provider.id}
                onPress={() => setSelectedProviderId(provider.id)}
                style={[styles.providerCard, isSelected && styles.providerCardActive]}
                accessibilityLabel={provider.name || PROVIDER_LABELS[provider.type]}
              >
                <View style={[styles.providerIcon, isSelected && styles.providerIconActive]}>
                  <IconCreditCard size={20} color={isSelected ? OCEAN.onDark : OCEAN.base} />
                </View>
                <AppText variant="base" weight="semibold" style={styles.providerName}>
                  {provider.name || PROVIDER_LABELS[provider.type]}
                </AppText>
                <View style={[styles.radio, isSelected && styles.radioActive]}>
                  {isSelected ? <IconCheck size={13} color={OCEAN.onDark} /> : null}
                </View>
              </OceanCard>
            );
          })}
        </View>
      )}

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton
        label="Payer"
        onPress={handlePay}
        disabled={!selectedProviderId}
        loading={initiatePayment.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  amountHero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  providerList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1.5,
  },
  providerCardActive: {
    borderColor: OCEAN.base,
    backgroundColor: OCEAN.mist,
  },
  providerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerIconActive: {
    backgroundColor: OCEAN.base,
  },
  providerName: {
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  radioActive: {
    backgroundColor: OCEAN.base,
    borderColor: OCEAN.base,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});