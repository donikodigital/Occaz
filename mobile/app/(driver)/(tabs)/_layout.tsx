// mobile/app/(driver)/(tabs)/_layout.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { IconHome, IconMessageCircle, IconRoute, IconUser, IconWallet } from '@tabler/icons-react-native';
import { colors } from '@/theme';
import { useDriverProfile, isDriverProfileMissingError } from '@/hooks/useDriverProfile';
import { ResponsiveTabBar } from '@/components/navigation/ResponsiveTabBar';

export default function DriverTabsLayout() {
  const profileQuery = useDriverProfile();

  if (profileQuery.isError && isDriverProfileMissingError(profileQuery.error)) {
    return <Redirect href="/(driver)/complete-profile" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} accentColor={colors.success} brandLabel="Espace chauffeur" />}
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
        name="wallet"
        options={{
          title: 'Portefeuille',
          tabBarIcon: ({ color, size }) => <IconWallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <IconMessageCircle size={size} color={color} />,
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

