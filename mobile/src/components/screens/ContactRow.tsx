// mobile/src/components/screens/ContactRow.tsx
//
// Appel et SMS natifs vers un numéro réel — pas de messagerie interne à
// construire, le téléphone de l'utilisateur (et le réseau GSM) s'en
// chargent déjà. Le numéro lui-même n'est révélé par le backend qu'une
// fois le paiement effectué (réservation CONFIRMED/COMPLETED, envoi
// avec conducteur assigné) — ce composant se contente d'afficher ce
// qu'on lui donne ; la vraie protection est côté serveur.
import React from 'react';
import { Linking, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { IconMessageCircle, IconPhone } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

export function ContactRow({ phone, name, style }: { phone: string; name?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      {name ? (
        <AppText variant="sm" weight="medium" style={styles.name} numberOfLines={1}>
          {name}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          onPress={() => Linking.openURL(`tel:${phone}`)}
          accessibilityRole="link"
          accessibilityLabel={`Appeler le ${phone}`}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <IconPhone size={14} color={colors.primary} />
          <AppText variant="xs" color={colors.primary} weight="semibold">
            Appeler
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(`sms:${phone}`)}
          accessibilityRole="link"
          accessibilityLabel={`Envoyer un SMS au ${phone}`}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <IconMessageCircle size={14} color={colors.primary} />
          <AppText variant="xs" color={colors.primary} weight="semibold">
            SMS
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  name: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  pressed: {
    opacity: 0.7,
  },
});