// mobile/app/(customer)/(tabs)/_layout.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { IconHome, IconRoute, IconUser } from '@tabler/icons-react-native';
import { colors } from '@/theme';
import { useCustomerProfile, isProfileMissingError } from '@/hooks/useCustomerProfile';
import { ResponsiveTabBar } from '@/components/navigation/ResponsiveTabBar';

/**
 * Onglet "Messages" (section 56) volontairement absent tant que le
 * module Messagerie du frontend n'existe pas (Lot 7) — mieux vaut trois
 * onglets pleinement fonctionnels qu'un quatrième qui ne mène nulle part.
 */
export default function CustomerTabsLayout() {
  const profileQuery = useCustomerProfile();

  // Profil pas encore créé (juste après la première connexion) : aucun
  // onglet n'a de données à afficher tant que ce n'est pas fait — voir
  // complete-profile.tsx.
  if (profileQuery.isError && isProfileMissingError(profileQuery.error)) {
    return <Redirect href="/(customer)/complete-profile" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} accentColor={colors.primary} brandLabel="Espace client" />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <IconHome size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trajets',
          tabBarIcon: ({ color, size }) => <IconRoute size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <IconUser size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
