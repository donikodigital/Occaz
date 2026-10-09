// mobile/app/(driver)/(tabs)/home.tsx
// [09/10/2026] v12 — bannière clignotante « Un client vous invite » quand un client demande au conducteur de prendre son colis (ShipmentInvitationBanner).
// [08/10/2026] v11 — (1) la carte de la route s'affiche enfin : GET /trips/mine ne renvoie pas les adresses (donc pas de coordonnées), le trajet
// affiché est maintenant relu en détail (useTrip) ; (2) le « prochain trajet » est le plus PROCHE dans le temps (la liste arrive triée du
// plus lointain au plus proche) ; (3) « Activité récente » mêle trajets créés, envois acceptés et notifications, chaque ligne ouvrant son
// élément.
// v11b — la carte retombe sur le centre des villes quand l'adresse du trajet n'a pas de coordonnées GPS (adresse saisie à la main).
// v10 — REFONTE de l'accueil d'après la maquette : bandeau bleu océan (avatar, nom, sceau, cloche) avec, à cheval dessus, la
// carte « Mon tableau de bord » (solde du portefeuille | nombre de trajets et de colis) ; barre de recherche (ouvre /(driver)/search) ;
// les deux tuiles « Créer un trajet » et « Envois disponibles » INCHANGÉES (seule la phrase de la première est reprise de la maquette) ;
// « Vos trajets en cours » (carte de la route, date, places, type, prix, deux boutons) ; « Activité récente » (dernières notifications) ;
// bouton flottant « + ». Les cartes de statistiques (note, anneau de trajets, véhicules) et l'itinéraire décoratif Conakry → Dakar
// quittent l'accueil : le tableau de bord les remplace, et la note vit sur le profil.
//
// [21/09/2026] v9 — tuile « Créer un trajet », badge de places et carte véhicule des statistiques passent en bleu Ocean ; la tuile « Envois disponibles » garde son jaune, propre aux colis.
//
// v8 — Plus d'air entre l'en-tête (profil + cloche) et ce qui suit (bandeau
// de statut, carte véhicule ou tuiles violette/jaune) : HomeHeader est
// enveloppé dans une vue avec une marge basse, valable quel que soit le
// bloc qui vient dessous.
//
// v7 — Le badge de places du « Prochain trajet » passe par
// formatSeatsAvailability (utils/seats.ts) : « Complet » / « 2 places
// libres » au lieu de « 0/2 places », qui se lisait aussi bien « 0 libre »
// que « 0 réservée » et ne collait pas avec l'écran détail du trajet.
//
// v6 — Header refondu dans un composant isolé (HomeHeader) : avatar
// cliquable + salutation à gauche, cloche de notifications en haut à
// droite. Le bouton de déconnexion est retiré d'ici — il reste dans
// l'écran Profil. Cartes de stats refaites dans un composant isolé
// (StatCard) : cause racine du débordement = `aspectRatio: 1` du v5, qui
// figeait la hauteur (~110 px) alors que le contenu (icône + valeur +
// libellé retombant sur 3-4 lignes) était plus haut. La hauteur suit
// maintenant le contenu, libellés courts à coupure explicite, et
// l'anneau ne porte plus que le nombre de trajets (le "0%" empilé dessous
// débordait de l'anneau). Carte "Prochain trajet" affinée : trajet en
// titre, date avec icône, places en badge, chevron.
//
// v5 — statCard passe en carré (aspectRatio: 1), toujours 3 par ligne
// (déjà garanti par statsRow en row sans wrap, inchangé). Les 2 grandes
// tuiles reçoivent un flourish illustré en haut à droite
// (TripTileIllustration / ShipmentTileIllustration, fichiers isolés) au
// lieu d'un fond photo — évite toute dépendance réseau à l'exécution et
// tout souci de licence, voir échange avec Doniko.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconCar, IconPackage, IconRoute, IconSearch } from '@tabler/icons-react-native';
import { AppText, Card, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanEmpty } from '@/components/ocean/OceanKit';
import { DashboardCard, HomeHero } from '@/components/home/HomeHero';
import { HomeFab, HomeSearchBar, HomeSectionTitle } from '@/components/home/HomeParts';
import { CurrentTripCard } from '@/components/home/CurrentTripCard';
import { routePoint } from '@/components/home/routePoint';
import { RecentActivity, notificationToActivity, sortActivity, type ActivityItem } from '@/components/home/RecentActivity';
import { TripTileIllustration } from '@/components/illustrations/TripTileIllustration';
import { ShipmentTileIllustration } from '@/components/illustrations/ShipmentTileIllustration';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useTrip } from '@/hooks/useTripSearch';
import { useAssignedShipments } from '@/hooks/useDriverShipments';
import { useMyWallet } from '@/hooks/useWallet';
import { useLatestMessageAlert, useMarkNotificationRead, useMyNotifications } from '@/hooks/useNotifications';
import { MessageAlertCard } from '@/components/screens/MessageAlertCard';
import { ShipmentInvitationBanner } from '@/components/screens/ShipmentInvitationBanner';
import { useMyInvitations } from '@/hooks/useShipmentInvitations';
import { formatDateShort, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { formatShipmentRoute } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS } from '@/utils/tripStatusLabels';
import type { AppNotification } from '@/types/notifications.types';

// Un trajet reste « en cours » jusqu'à sa clôture (COMPLETED) : ARRIVED = arrivé à destination mais dépose(s) pas encore validée(s).
const UPCOMING_STATUSES = new Set(['PUBLISHED', 'BOOKING_PENDING', 'CONFIRMED', 'DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'IN_PROGRESS', 'ARRIVED']);
// Le trajet réellement entamé passe avant un trajet simplement programmé, même plus tôt dans la liste.
const RUNNING_STATUSES = new Set(['DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'IN_PROGRESS', 'ARRIVED']);
const ACTIVITY_COUNT = 5;

export default function DriverHomeScreen() {
  const { data: profile } = useDriverProfile();
  const { data: vehicles } = useMyVehicles();
  const { data: tripsPage } = useMyTrips();
  const { data: shipmentsPage } = useAssignedShipments();
  const { data: wallet } = useMyWallet();
  // Pas d'endpoint compteur dédié — approximation à partir de la première
  // page de notifications (30 les plus récentes). Sous-compte si plus de
  // 30 non lues d'un coup, cas limite acceptable pour un badge d'accueil.
  const { data: notificationsPage, isLoading: notificationsLoading } = useMyNotifications(1);
  const messageAlert = useLatestMessageAlert();
  // Seul un conducteur validé peut recevoir des invitations (le serveur refuse les autres).
  const { data: invitations } = useMyInvitations(profile?.status === 'VALIDATED');
  const pendingInvitations = invitations ?? [];
  const markNotificationRead = useMarkNotificationRead();

  // La liste arrive du plus lointain au plus proche : on trie pour que « en cours » soit le trajet entamé, sinon le prochain départ.
  const upcomingTrips = (tripsPage?.data.filter((trip) => UPCOMING_STATUSES.has(trip.status)) ?? []).sort((a, b) => {
    const running = Number(RUNNING_STATUSES.has(b.status)) - Number(RUNNING_STATUSES.has(a.status));
    return running !== 0 ? running : new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
  });
  const nextTripSummary = upcomingTrips[0];
  // La liste ne contient pas les adresses ; le détail, si : c'est lui qui donne les coordonnées de la carte.
  const { data: nextTripDetail } = useTrip(nextTripSummary?.id);
  const nextTrip = nextTripDetail && nextTripDetail.id === nextTripSummary?.id ? { ...nextTripSummary, ...nextTripDetail } : nextTripSummary;
  const notifications = notificationsPage?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '…';
  const walletCurrency = wallet?.currency?.isoCode;

  function openNotification(notification: AppNotification) {
    if (!notification.readAt) markNotificationRead.mutate(notification.id);
    const conversationId = notification.payload?.conversationId;
    if (notification.type === 'CONVERSATION_MESSAGE' && typeof conversationId === 'string') {
      router.push(`/(driver)/conversation/${conversationId}`);
    } else {
      router.push('/(driver)/notifications');
    }
  }

  const activityItems: ActivityItem[] = sortActivity(
    [
      ...notifications.map((notification) => notificationToActivity(notification, () => openNotification(notification))),
      ...(tripsPage?.data ?? []).map((trip): ActivityItem => ({
        key: `t-${trip.id}`,
        icon: IconRoute,
        tone: 'ocean',
        title: 'Trajet publié',
        text: `${trip.originCity.name} → ${trip.destinationCity.name} · ${formatDateShort(trip.departureAt)}`,
        at: trip.createdAt,
        onPress: () => router.push(`/(driver)/trip/${trip.id}`),
      })),
      ...(shipmentsPage?.data ?? []).map((shipment): ActivityItem => ({
        key: `s-${shipment.id}`,
        icon: IconPackage,
        tone: 'gold',
        title: `Envoi · ${SHIPMENT_STATUS_LABELS[shipment.status]}`,
        text: formatShipmentRoute(shipment) ?? shipment.recipientName,
        at: shipment.updatedAt,
        onPress: () => router.push(`/(driver)/shipment/${shipment.id}`),
      })),
    ],
    ACTIVITY_COUNT,
  );


  return (
    <View style={styles.root}>
      <ScreenContainer scroll padded={false} edges={['bottom']}>
        <HomeHero
          firstName={profile?.firstName}
          lastName={profile?.lastName}
          initials={initials}
          photoUri={profile?.photoUrl}
          isVerified={profile?.status === 'VALIDATED'}
          unreadCount={unreadCount}
          onPressAvatar={() => router.navigate('/(driver)/(tabs)/profile')}
          onPressNotifications={() => router.push('/(driver)/notifications')}
        />

        <DashboardCard
          main={{
            label: 'Solde',
            value: wallet ? formatMoney(wallet.balance, walletCurrency) : '—',
            hint: wallet && Number(wallet.pendingBalance) > 0 ? `${formatMoney(wallet.pendingBalance, walletCurrency)} en attente` : 'Disponible',
            onPress: () => router.navigate('/(driver)/(tabs)/wallet'),
          }}
          stats={[
            { label: 'Vos trajets', value: tripsPage ? String(tripsPage.meta.total) : '—' },
            { label: 'Vos colis', value: shipmentsPage ? String(shipmentsPage.meta.total) : '—' },
          ]}
        />

        <HomeSearchBar
          placeholder="Rechercher un trajet, un envoi ou une ville"
          onPress={() => router.push('/(driver)/search')}
        />

        <View style={styles.content}>
          {pendingInvitations.length > 0 ? (
            <View style={styles.block}>
              <ShipmentInvitationBanner
                count={pendingInvitations.length}
                destinationCity={pendingInvitations[0].shipment.recipientLocation.label}
                onPress={() => router.push('/(driver)/shipment-invitations')}
              />
            </View>
          ) : null}

          {messageAlert ? (
            <View style={styles.block}>
              <MessageAlertCard
                senderName={messageAlert.title ?? 'Nouveau message'}
                preview={messageAlert.body ?? ''}
                onPress={() => {
                  markNotificationRead.mutate(messageAlert.id);
                  const conversationId = messageAlert.payload?.conversationId;
                  if (typeof conversationId === 'string') {
                    router.push(`/(driver)/conversation/${conversationId}`);
                  } else {
                    router.push('/(driver)/(tabs)/messages');
                  }
                }}
              />
            </View>
          ) : null}

          {profile && profile.status !== 'VALIDATED' ? (
            <Card style={[styles.statusBanner, styles.block]}>
              <IconAlertTriangle size={18} color={colors.accentDark} />
              <AppText variant="sm" color={colors.accentDark} style={{ flex: 1 }}>
                {profile.status === 'PENDING'
                  ? 'Votre profil est en cours de vérification par notre équipe.'
                  : profile.status === 'SUSPENDED'
                    ? 'Votre compte est suspendu — contactez le support.'
                    : 'Votre dossier a été rejeté — contactez le support pour en savoir plus.'}
              </AppText>
            </Card>
          ) : null}

          {vehicles && vehicles.length === 0 ? (
            <Pressable onPress={() => router.push('/(driver)/vehicle-new')} style={[styles.setupCard, styles.block]}>
              <IconCar size={20} color={OCEAN.base} />
              <AppText variant="sm" weight="medium" style={{ flex: 1 }}>
                Ajoutez un véhicule pour commencer à proposer des trajets
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.tileRow}>
              <Pressable
                onPress={() => router.push('/(driver)/trip-new')}
                style={[styles.tile, { backgroundColor: OCEAN.deep }]}
              >
                <View style={styles.tileIllustration}>
                  <TripTileIllustration />
                </View>
                <IconCar size={36} color={OCEAN.onDark} style={styles.tileIcon} />
                <AppText variant="base" weight="semibold" color={OCEAN.onDark}>
                  Créer un trajet
                </AppText>
                <AppText variant="xs" color={OCEAN.onDark} style={styles.tileSubtitle}>
                  Partagez votre route, réduisez vos coûts.
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(driver)/shipment-available')}
                style={[styles.tile, { backgroundColor: colors.accent }]}
              >
                <View style={styles.tileIllustration}>
                  <ShipmentTileIllustration />
                </View>
                <IconPackage size={36} color={colors.onAccent} style={styles.tileIcon} />
                <AppText variant="base" weight="semibold" color={colors.onAccent}>
                  Envois disponibles
                </AppText>
                <AppText variant="xs" color={colors.onAccent} style={styles.tileSubtitle}>
                  Livrer des colis
                </AppText>
              </Pressable>
            </View>
          )}

          <HomeSectionTitle
            title="Vos trajets en cours"
            actionLabel={upcomingTrips.length > 1 ? `Voir tout (${upcomingTrips.length})` : 'Voir tout'}
            onPressAction={() => router.navigate('/(driver)/(tabs)/trips')}
          />
          <View style={styles.block}>
            {nextTrip ? (
              <CurrentTripCard
                eyebrow="Trajet partagé"
                originName={nextTrip.originCity.name}
                destinationName={nextTrip.destinationCity.name}
                origin={routePoint(nextTrip.originLocation, nextTrip.originCity)}
                destination={routePoint(nextTrip.destinationLocation, nextTrip.destinationCity)}
                columns={[
                  { label: 'Date', value: `${formatDateShort(nextTrip.departureAt)} · ${formatTime(nextTrip.departureAt)}`, flex: 1.1 },
                  { label: 'Places libres', value: `${nextTrip.availableSeats}/${nextTrip.totalSeats}`, flex: 0.8 },
                  // « Passagers » sur la première ligne, « Colis » sur la deuxième : jamais coupé.
                  { label: 'Type', value: nextTrip.allowsShipments ? 'Passagers\nColis' : 'Passagers', flex: 1.25 },
                  { label: 'Prix', value: formatMoney(nextTrip.pricePerSeat, nextTrip.currency?.isoCode ?? walletCurrency), flex: 1.1 },
                ]}
                primary={{ label: nextTrip.status === 'ARRIVED' ? 'Valider la dépose' : 'Gérer le trajet', onPress: () => router.push(`/(driver)/trip/${nextTrip.id}`) }}
                secondary={{ label: nextTrip.status === 'ARRIVED' ? 'Voir les passagers à déposer' : 'Voir les passagers', onPress: () => router.push(`/(driver)/trip/${nextTrip.id}`) }}
                onPress={() => router.push(`/(driver)/trip/${nextTrip.id}`)}
              />
            ) : (
              <OceanEmpty
                icon={<IconRoute size={28} color={OCEAN.base} />}
                title="Aucun trajet en cours"
                text="Publiez un trajet pour que des passagers puissent réserver une place."
                action={
                  vehicles && vehicles.length > 0 ? (
                    <OceanButton label="Publier un trajet" onPress={() => router.push('/(driver)/trip-new')} style={styles.emptyButton} />
                  ) : undefined
                }
              />
            )}
          </View>

          <HomeSectionTitle
            title="Activité récente"
            actionLabel="Mon activité"
            onPressAction={() => router.navigate('/(driver)/(tabs)/trips')}
          />
          <RecentActivity
            items={activityItems}
            isLoading={notificationsLoading}
            onPressAll={() => router.push('/(driver)/notifications')}
          />
        </View>
      </ScreenContainer>

      <HomeFab
        actions={[
          { label: 'Créer un trajet', icon: <IconCar size={20} color={OCEAN.base} />, onPress: () => router.push('/(driver)/trip-new') },
          {
            label: 'Envois disponibles',
            icon: <IconPackage size={20} color={OCEAN.goldInk} />,
            onPress: () => router.push('/(driver)/shipment-available'),
          },
          { label: 'Rechercher', icon: <IconSearch size={20} color={OCEAN.base} />, onPress: () => router.push('/(driver)/search') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 110,
  },
  block: {
    marginBottom: spacing.lg,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderColor: colors.accentLight,
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: OCEAN.mist,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.xl,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 140,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tileIllustration: {
    position: 'absolute',
    top: -14,
    right: -18,
    transform: [{ rotate: '-6deg' }],
  },
  tileIcon: {
    marginBottom: spacing.md,
  },
  tileSubtitle: {
    opacity: 0.85,
    marginTop: 2,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});