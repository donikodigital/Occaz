// mobile/app/(driver)/(tabs)/profile.tsx
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCamera,
  IconCar,
  IconChevronRight,
  IconEdit,
  IconLogout,
  IconPhone,
  IconPlus,
  IconShieldCheck,
  IconStarFilled,
  IconUser,
} from '@tabler/icons-react-native';
import { AppText, Badge, ScreenContainer } from '@/components/ui';
import { VehicleDetailModal } from '@/components/screens/VehicleDetailModal';
import { colors, radius, spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';
import type { Vehicle } from '@/types/vehicles.types';

/**
 * Palette "bleu océan" propre à cet écran. À déplacer dans `@/theme`
 * si tu veux la réutiliser sur d'autres écrans.
 */
const OCEAN = {
  deep: '#083A63',
  base: '#0B6BA8',
  bright: '#1E9BD7',
  sky: '#8FD3F4',
  mist: '#EAF5FB',
  mistBorder: '#D3E8F4',
  field: '#F3F8FC',
  ink: '#0B2A44',
  gold: '#FFD166',
  white: '#FFFFFF',
} as const;

const VEHICLE_STATUS_LABEL: Record<Vehicle['verificationStatus'], string> = {
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
  PENDING: 'En attente',
};
const VEHICLE_STATUS_TONE: Record<Vehicle['verificationStatus'], 'success' | 'danger' | 'accent'> = {
  VERIFIED: 'success',
  REJECTED: 'danger',
  PENDING: 'accent',
};

/** Statuts DriverProfile.status autres que VALIDATED — mêmes libellés que la bannière de home.tsx, pour rester cohérent entre les deux écrans. */
const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente de vérification',
  IN_VERIFICATION: 'Vérification en cours',
  SUSPENDED: 'Compte suspendu',
  BLOCKED: 'Compte bloqué',
  DEACTIVATED: 'Compte désactivé',
};

function RoundButton({
  icon,
  label,
  onPress,
  size = 40,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

function ProfilePhoto({ uri, initials }: { uri?: string | null; initials: string }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.photo} />;
  }
  return (
    <View style={[styles.photo, styles.photoFallback]}>
      <AppText variant="xl" weight="bold" color={OCEAN.white}>
        {initials.toUpperCase()}
      </AppText>
    </View>
  );
}

function SectionHeader({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>{icon}</View>
      <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.sectionLabel}>
        {label}
      </AppText>
      <View style={styles.sectionLine} />
      {action}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldCell}>
      <AppText variant="xs" weight="semibold" color="textMuted" style={styles.fieldLabel}>
        {label}
      </AppText>
      <View style={styles.fieldBox}>
        <AppText variant="sm" weight="medium" color={OCEAN.ink}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

export default function DriverProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useDriverProfile();
  const { data: vehicles } = useMyVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';
  const isValidated = profile?.status === 'VALIDATED';
  const accountStatusLabel = profile && !isValidated ? ACCOUNT_STATUS_LABEL[profile.status] : null;

  return (
    <ScreenContainer scroll padded={false}>
      {/* Barre du haut */}
      <View style={styles.topBar}>
        <RoundButton
          icon={<IconArrowLeft size={18} color={OCEAN.base} />}
          label="Retour au tableau de bord"
          onPress={() => router.push('/(driver)/(tabs)/home')}
        />
        <View style={styles.topBarTitle}>
          <AppText variant="base" weight="semibold" color={OCEAN.ink}>
            Mon profil
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Compte chauffeur
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        {/* Hero compact */}
        <View style={styles.hero}>
          <View style={styles.heroDecor} pointerEvents="none">
            <View style={styles.blobLarge} />
            <View style={styles.blobSmall} />
          </View>

          <View style={styles.heroRow}>
            <View style={styles.photoWrap}>
              <ProfilePhoto uri={profile?.photoUrl} initials={initials} />
              <Pressable
                onPress={() => router.push('/(driver)/edit-profile')}
                accessibilityRole="button"
                accessibilityLabel="Modifier la photo"
                style={({ pressed }) => [styles.cameraBadge, pressed && styles.pressed]}
              >
                <IconCamera size={13} color={OCEAN.deep} />
              </Pressable>
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.rolePill}>
                {isValidated ? <IconShieldCheck size={12} color={OCEAN.gold} /> : null}
                <AppText variant="xs" weight="bold" color={OCEAN.white} style={styles.roleLabel}>
                  {isValidated ? 'Chauffeur validé' : 'Chauffeur'}
                </AppText>
              </View>

              <View style={styles.nameRow}>
                <AppText variant="xl" weight="bold" color={OCEAN.white}>
                  {profile ? profile.firstName : '…'}
                </AppText>
                {profile ? (
                  <AppText variant="xl" weight="bold" color={OCEAN.gold}>
                    {profile.lastName}
                  </AppText>
                ) : null}
              </View>

              {profile?.averageRating ? (
                <View style={styles.ratingRow}>
                  <IconStarFilled size={12} color={OCEAN.gold} />
                  <AppText variant="xs" weight="semibold" color={OCEAN.white}>
                    {profile.averageRating.toFixed(1)} · {profile.ratingsCount} avis
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          {accountStatusLabel ? (
            <View style={styles.statusStrip}>
              <IconAlertTriangle size={14} color={OCEAN.gold} />
              <AppText variant="xs" weight="medium" color={OCEAN.gold}>
                {accountStatusLabel}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Action principale */}
        <Pressable
          onPress={() => router.push('/(driver)/edit-profile')}
          accessibilityRole="button"
          accessibilityLabel="Modifier mon profil"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <IconEdit size={18} color={OCEAN.white} />
          <AppText variant="sm" weight="semibold" color={OCEAN.white}>
            Modifier mon profil
          </AppText>
        </Pressable>

        {/* Identité & contact */}
        <View style={styles.card}>
          <SectionHeader icon={<IconUser size={16} color={OCEAN.base} />} label="Identité & contact" />

          <View style={styles.fieldGrid}>
            <Field label="Prénom" value={profile?.firstName ?? '—'} />
            <Field label="Nom" value={profile?.lastName ?? '—'} />
          </View>

          <View>
            <AppText variant="xs" weight="semibold" color="textMuted" style={styles.fieldLabel}>
              Téléphone
            </AppText>
            <View style={[styles.fieldBox, styles.phoneBox]}>
              <IconPhone size={16} color={OCEAN.base} />
              <AppText variant="sm" weight="medium" color={OCEAN.ink} style={styles.phoneValue}>
                {user?.phone}
              </AppText>
              {user?.isPhoneVerified ? <Badge label="Vérifié" tone="success" /> : null}
            </View>
          </View>
        </View>

        {/* Véhicules */}
        <View style={styles.card}>
          <SectionHeader
            icon={<IconCar size={16} color={OCEAN.base} />}
            label="Mes véhicules"
            action={
              <RoundButton
                size={32}
                icon={<IconPlus size={16} color={OCEAN.base} />}
                label="Ajouter un véhicule"
                onPress={() => router.push('/(driver)/vehicle-new')}
              />
            }
          />

          <View style={styles.vehicleList}>
            {(vehicles ?? []).map((vehicle) => (
              <Pressable
                key={vehicle.id}
                onPress={() => setSelectedVehicle(vehicle)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.vehicleRow, pressed && styles.pressed]}
              >
                <View style={styles.vehicleIcon}>
                  <IconCar size={18} color={OCEAN.base} />
                </View>
                <View style={styles.rowText}>
                  <AppText variant="sm" weight="semibold" color={OCEAN.ink}>
                    {vehicle.brand} {vehicle.model}
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {vehicle.plateNumber} · {vehicle.totalSeats} places
                  </AppText>
                </View>
                <Badge
                  label={VEHICLE_STATUS_LABEL[vehicle.verificationStatus]}
                  tone={VEHICLE_STATUS_TONE[vehicle.verificationStatus]}
                />
                <IconChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            ))}
            {vehicles && vehicles.length === 0 ? (
              <AppText variant="sm" color="textMuted" style={styles.emptyText}>
                Aucun véhicule ajouté.
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Litiges */}
        <Pressable
          onPress={() => router.push('/(driver)/disputes')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.pressed]}
        >
          <View style={styles.sectionIcon}>
            <IconAlertTriangle size={16} color={OCEAN.base} />
          </View>
          <AppText variant="md" weight="medium" color={OCEAN.ink} style={styles.rowText}>
            Mes litiges
          </AppText>
          <IconChevronRight size={16} color={colors.textMuted} />
        </Pressable>

        {/* Déconnexion */}
        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        >
          <IconLogout size={18} color={OCEAN.base} />
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            Se déconnecter
          </AppText>
        </Pressable>
      </View>

      <VehicleDetailModal vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },

  // --- Barre du haut ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: OCEAN.mist,
    borderBottomWidth: 1,
    borderBottomColor: OCEAN.mistBorder,
  },
  topBarTitle: {
    flex: 1,
  },
  roundButton: {
    backgroundColor: OCEAN.white,
    borderWidth: 1,
    borderColor: OCEAN.mistBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Corps ---
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },

  // --- Hero compact ---
  hero: {
    borderRadius: 24,
    backgroundColor: OCEAN.deep,
    padding: spacing.lg,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroDecor: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: 'hidden',
  },
  blobLarge: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(30,155,215,0.38)',
  },
  blobSmall: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(143,211,244,0.16)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  photoWrap: {
    width: 72,
    height: 72,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  photoFallback: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: OCEAN.gold,
    borderWidth: 2,
    borderColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  roleLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(255,209,102,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.4)',
  },

  // --- Boutons ---
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 50,
    borderRadius: 16,
    backgroundColor: OCEAN.base,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 50,
    borderRadius: 16,
    backgroundColor: OCEAN.white,
    borderWidth: 1.5,
    borderColor: OCEAN.base,
  },

  // --- Cartes & sections ---
  card: {
    backgroundColor: OCEAN.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OCEAN.mistBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: OCEAN.mistBorder,
  },

  // --- Champs ---
  fieldGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldCell: {
    flex: 1,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldBox: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    backgroundColor: OCEAN.field,
    borderWidth: 1,
    borderColor: OCEAN.mistBorder,
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  phoneValue: {
    flex: 1,
  },

  // --- Véhicules ---
  vehicleList: {
    gap: spacing.xs,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: OCEAN.field,
    borderWidth: 1,
    borderColor: OCEAN.mistBorder,
  },
  vehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: OCEAN.white,
    borderWidth: 1,
    borderColor: OCEAN.mistBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  // --- Lien litiges ---
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});