// mobile/app/(customer)/saved-cards.tsx
//
// v1 — Mes cartes bancaires. Aucun ajout n'est proposé ici : l'app n'a
// pas encore de SDK de tokenisation de carte intégré (le paiement repose
// sur le mobile money) — cet écran liste et gère les cartes que ce SDK
// ajoutera une fois branché (voir SavedCardsService, backend).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { IconCreditCard, IconStar, IconTrash } from '@tabler/icons-react-native';
import { AppText, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanPill, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMySavedCards, useRemoveSavedCard, useSetDefaultSavedCard } from '@/hooks/usePromotions';
import type { SavedCard } from '@/types/promotions.types';

function CardRow({ card }: { card: SavedCard }) {
  const removeCard = useRemoveSavedCard();
  const setDefault = useSetDefaultSavedCard();

  function handleRemove() {
    Alert.alert('Retirer cette carte ?', `Carte se terminant par ${card.last4}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeCard.mutate(card.id) },
    ]);
  }

  return (
    <OceanCard style={styles.row}>
      <View style={styles.icon}>
        <IconCreditCard size={18} color={OCEAN.base} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold">
          {card.brand ?? 'Carte'} •••• {card.last4}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          Expire {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
        </AppText>
      </View>
      {card.isDefault ? (
        <OceanPill label="Par défaut" tone="ocean" />
      ) : (
        <IconButton
          icon={<IconStar size={16} color={colors.textSecondary} />}
          accessibilityLabel="Définir par défaut"
          onPress={() => setDefault.mutate(card.id)}
        />
      )}
      <IconButton icon={<IconTrash size={16} color={colors.danger} />} accessibilityLabel="Retirer" onPress={handleRemove} />
    </OceanCard>
  );
}

export default function SavedCardsScreen() {
  const { data: cards, isLoading } = useMySavedCards();

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanScreenHeader title="Mes cartes bancaires" onBack={() => router.back()} />
      </View>

      <ResponsiveList
        data={cards ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconCreditCard size={26} color={OCEAN.base} />}
              title="Aucune carte enregistrée"
              text="Le paiement par carte n'est pas encore disponible dans l'app — utilisez mobile money pour le moment."
            />
          ) : undefined
        }
        renderItem={({ item }) => <CardRow card={item} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});