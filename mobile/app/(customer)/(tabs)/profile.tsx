// mobile/app/(customer)/(tabs)/profile.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconCheck, IconChevronRight, IconEdit, IconLogout, IconPhone, IconUserCircle } from '@tabler/icons-react-native';
import { AppText, Avatar, Badge, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

export default function CustomerProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useCustomerProfile();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Avatar initials={initials} imageUri={profile?.photoUrl} size={56} />
        <View style={{ flex: 1 }}>
          <AppText variant="lg" weight="semibold">
            {profile ? `${profile.firstName} ${profile.lastName}` : '…'}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            Compte client
          </AppText>
        </View>
        <IconButton
          icon={<IconEdit size={18} color={colors.textPrimary} />}
          accessibilityLabel="Modifier le profil"
          onPress={() => router.push('/(customer)/edit-profile')}
        />
        <IconButton
          icon={<IconLogout size={18} color={colors.danger} />}
          accessibilityLabel="Se déconnecter"
          onPress={handleLogout}
        />
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconPhone size={18} color={colors.primary} />
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
            <IconUserCircle size={18} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Email
            </AppText>
            <AppText variant="md" weight="medium">
              {user?.email ?? 'Non renseigné'}
            </AppText>
          </View>
        </View>
      </Card>

      <Card onPress={() => router.push('/(customer)/disputes')} style={styles.row}>
        <View style={styles.rowIcon}>
          <IconAlertTriangle size={18} color={colors.primary} />
        </View>
        <AppText variant="md" weight="medium" style={styles.rowText}>
          Mes litiges
        </AppText>
        <IconChevronRight size={16} color={colors.textMuted} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
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
    backgroundColor: colors.primaryLight,
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
