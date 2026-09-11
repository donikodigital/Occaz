// mobile/app/(driver)/home.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCheck, IconLogout, IconPhone, IconSteeringWheel } from '@tabler/icons-react-native';
import { AppText, Badge, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';

/**
 * Écran de destination minimal pour ce Lot — voir la note dans
 * (customer)/(tabs)/home.tsx. Le tableau de bord chauffeur (prochain trajet,
 * portefeuille, section 46) arrive avec les lots Trajets et Paiement du
 * frontend.
 */
export default function DriverHomeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <AppText variant="sm" color="textSecondary">
            Connecté en tant que
          </AppText>
          <AppText variant="xl" weight="semibold">
            Chauffeur
          </AppText>
        </View>
        <IconButton
          icon={<IconLogout size={18} color={colors.danger} />}
          accessibilityLabel="Se déconnecter"
          onPress={handleLogout}
        />
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconPhone size={18} color={colors.success} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Téléphone
            </AppText>
            <AppText variant="md" weight="medium">
              {user?.phone}
            </AppText>
          </View>
          {user?.isPhoneVerified ? (
            <Badge label="Vérifié" tone="success" icon={<IconCheck size={12} color={colors.successDark} />} />
          ) : null}
        </View>

        <Divider />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconSteeringWheel size={18} color={colors.success} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Type de compte
            </AppText>
            <AppText variant="md" weight="medium">
              Chauffeur
            </AppText>
          </View>
        </View>
      </Card>

      <AppText variant="sm" color="textMuted" align="center" style={styles.footnote}>
        La création de trajets et le portefeuille arrivent avec les prochains lots.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  footnote: {
    marginTop: spacing.xl,
  },
});
