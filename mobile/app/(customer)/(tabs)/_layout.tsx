// mobile/app/(customer)/(tabs)/_layout.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import React from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { IconHome, IconMessageCircle, IconRoute, IconUser } from '@tabler/icons-react-native';
import { OCEAN } from '@/theme/ocean';
import { useCustomerProfile, isProfileMissingError } from '@/hooks/useCustomerProfile';
import { ResponsiveTabBar } from '@/components/navigation/ResponsiveTabBar';
import { useT } from '@/i18n';

export default function CustomerTabsLayout() {
  const t = useT();
  const profileQuery = useCustomerProfile();

  // Profil pas encore créé (juste après la première connexion) : aucun
  // onglet n'a de données à afficher tant que ce n'est pas fait — voir
  // complete-profile.tsx.
  if (profileQuery.isError && isProfileMissingError(profileQuery.error)) {
    return <Redirect href="/(customer)/complete-profile" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} accentColor={OCEAN.base} brandLabel={t('Espace client')} />}
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