// mobile/app/(customer)/(tabs)/_layout.tsx
import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { IconHome, IconRoute, IconUser } from '@tabler/icons-react-native';
import { colors, fontFamily } from '@/theme';
import { useCustomerProfile, isProfileMissingError } from '@/hooks/useCustomerProfile';

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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: 11,
        },
      }}
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
