// mobile/app/(customer)/payment.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconCheck, IconCreditCard } from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
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
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Paiement
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <Card style={styles.amountCard}>
        <AppText variant="sm" color="textSecondary">
          Montant à payer
        </AppText>
        <AppText variant="display" weight="bold">
          {isLoadingAmount ? '…' : formatMoney(totalAmount ?? '0')}
        </AppText>
      </Card>

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Moyen de paiement
      </AppText>

      {providersLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !providers || providers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="sm" color="textSecondary" align="center">
            Aucun moyen de paiement n'est disponible pour le moment. Contactez le support.
          </AppText>
        </Card>
      ) : (
        <View style={styles.providerList}>
          {providers.map((provider) => {
            const isSelected = provider.id === selectedProviderId;
            return (
              <Card
                key={provider.id}
                onPress={() => setSelectedProviderId(provider.id)}
                style={[styles.providerCard, isSelected && styles.providerCardActive]}
              >
                <View style={styles.providerRow}>
                  <View style={styles.providerIcon}>
                    <IconCreditCard size={18} color={colors.primary} />
                  </View>
                  <AppText variant="base" weight="medium" style={{ flex: 1 }}>
                    {provider.name || PROVIDER_LABELS[provider.type]}
                  </AppText>
                  {isSelected ? (
                    <View style={styles.checkIcon}>
                      <IconCheck size={13} color={colors.onPrimary} />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  amountCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
  providerList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  providerCard: {
    padding: spacing.sm + 2,
  },
  providerCardActive: {
    borderColor: colors.primary,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  providerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
