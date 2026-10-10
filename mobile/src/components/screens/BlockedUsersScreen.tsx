// mobile/src/components/screens/BlockedUsersScreen.tsx
// [11/10/2026] v1 — « Utilisateurs bloqués » : la liste des personnes que vous avez bloquées, avec « Débloquer ». Partagé client / conducteur.
// Seule la liste de VOS blocages est visible : on ne dit jamais à quelqu'un qu'il a été bloqué.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconUserOff } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ApiError } from '@/services/api/ApiError';
import { useBlockedUsers, useUnblockUser } from '@/hooks/useSafety';
import { formatDateLong } from '@/utils/date';

export function BlockedUsersScreen() {
  const { data, isLoading, isError, error, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState<string | undefined>();

  const blocked = data ?? [];

  function handleUnblock(userId: string) {
    setErrorText(undefined);
    setWorkingId(userId);
    unblock.mutate(userId, {
      onSettled: () => setWorkingId(null),
      onError: (err) => setErrorText(err instanceof ApiError ? err.message : 'Impossible de débloquer pour le moment.'),
    });
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title="Utilisateurs bloqués" subtitle="Aucun contact possible avec eux" icon={<IconUserOff />} onBack={() => router.back()} />

      {errorText ? (
        <View style={styles.banner}>
          <FeedbackBanner tone="error" text={errorText} onDismiss={() => setErrorText(undefined)} />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={OCEAN.base} style={styles.loader} />
      ) : isError ? (
        <OceanEmpty
          icon={<IconUserOff size={26} color={OCEAN.base} />}
          title="Impossible de charger la liste"
          text={error instanceof ApiError ? error.message : 'Vérifiez votre connexion puis réessayez.'}
          action={<OceanButton label="Réessayer" variant="outline" onPress={() => void refetch()} />}
        />
      ) : blocked.length === 0 ? (
        <OceanEmpty
          icon={<IconUserOff size={26} color={OCEAN.base} />}
          title="Personne n’est bloqué"
          text="Vous pouvez bloquer quelqu’un depuis « Signaler ou bloquer », sur la page d’un trajet ou d’une réservation."
        />
      ) : (
        <View style={styles.list}>
          <AppText variant="xs" color="textSecondary">
            Une personne bloquée ne peut plus réserver chez vous, vous inviter ni vous écrire — et inversement. Ce qui est déjà réservé reste valable.
          </AppText>
          {blocked.map((entry) => (
            <OceanCard key={entry.id} style={styles.card}>
              <View style={styles.cardText}>
                <AppText variant="base" weight="semibold" numberOfLines={1}>
                  {entry.name}
                </AppText>
                <View style={styles.meta}>
                  <OceanPill label={entry.accountType === 'DRIVER' ? 'Conducteur' : 'Client'} tone="neutral" />
                  <AppText variant="xs" color="textMuted">
                    depuis le {formatDateLong(entry.createdAt)}
                  </AppText>
                </View>
              </View>
              <OceanButton label="Débloquer" variant="outline" onPress={() => handleUnblock(entry.userId)} loading={workingId === entry.userId} disabled={workingId !== null} style={styles.button} />
            </OceanCard>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
  loader: { marginVertical: spacing.xl },
  list: { gap: spacing.sm, marginBottom: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  cardText: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  button: { paddingHorizontal: spacing.md, minHeight: 40 },
});
