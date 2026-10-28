// mobile/app/(driver)/(tabs)/_layout.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import React from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { IconHome, IconMessageCircle, IconRoute, IconUser, IconWallet } from '@tabler/icons-react-native';
import { colors } from '@/theme';
import { useDriverProfile, isDriverProfileMissingError } from '@/hooks/useDriverProfile';
import { ResponsiveTabBar } from '@/components/navigation/ResponsiveTabBar';
import { useT } from '@/i18n';

export default function DriverTabsLayout() {
  const t = useT();
  const profileQuery = useDriverProfile();

  if (profileQuery.isError && isDriverProfileMissingError(profileQuery.error)) {
    return <Redirect href="/(driver)/complete-profile" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} accentColor={colors.success} brandLabel={t('Espace conducteur')} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('Accueil'),
          tabBarIcon: ({ color, size }) => <IconHome size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('Trajets'),
          tabBarIcon: ({ color, size }) => <IconRoute size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('Portefeuille'),
          tabBarIcon: ({ color, size }) => <IconWallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('Messages'),
          tabBarIcon: ({ color, size }) => <IconMessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Profil'),
          tabBarIcon: ({ color, size }) => <IconUser size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

