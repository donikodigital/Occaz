// mobile/app/(customer)/(tabs)/home.tsx
// [10/10/2026] v+ — « Message indisponible » s'affiche dans la page (bannière) au lieu d'Alert.alert, sans effet sur le web.
// [10/10/2026] v+ — action « Suivre un colis » dans le bouton + (saisie d'un numéro de suivi).
// [08/10/2026] v4 — (1) la carte de la route s'affiche aussi côté client : la liste des réservations ne contient pas les adresses, le trajet
// est relu en détail (useTrip) pour en tirer les coordonnées ; (2) « Activité récente » mêle réservations, colis, recherches de trajet et
// notifications, chaque ligne ouvrant son élément (une recherche se relance d'un geste).
// v4b — la carte retombe sur le centre des villes quand l'adresse du trajet n'a pas de coordonnées GPS (adresse saisie à la main).
// v3 — REFONTE de l'accueil d'après la maquette (même structure que l'accueil conducteur) : bandeau bleu océan (avatar, nom,
// cloche) avec, à cheval dessus, la carte « Mon tableau de bord » (paiements en attente | nombre de trajets et de colis) ; barre de
// recherche « Rechercher un trajet, un colis ou un chauffeur » (ouvre /(customer)/search, avec les recherches récentes) ; les deux
// tuiles « Trouver un trajet » et « Envoyer un colis » INCHANGÉES (seule la phrase de la seconde est reprise de la maquette) ;
// « Vos trajets en cours » (la prochaine réservation payée ou confirmée) ; « Activité récente » (dernières notifications) ; bouton
// flottant « + ». Le client n'a pas de portefeuille : le chiffre principal est ce qu'il lui reste à payer. Les recherches récentes et
// « Voyager en confiance » quittent l'accueil : les premières sont dans l'écran de recherche.
//
// v2 — Accueil client construit sur le même modèle que l'accueil conducteur :
// même en-tête (avatar, salutation, cloche avec compteur), mêmes tuiles
// illustrées, même rythme. Les couleurs passent au bleu océan du profil
// conducteur ; la tuile « Envoyer un colis » garde le jaune des envois, comme
// « Envois disponibles » côté conducteur.

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { IconClockSearch, IconPackage, IconRoute, IconSearch, IconSend } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer } from '@/components/ui';
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
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useMyBookings } from '@/hooks/useBookings';
import { useTrip } from '@/hooks/useTripSearch';
import { useMyShipments } from '@/hooks/useShipments';
import { useGetOrCreateConversationForBooking } from '@/hooks/useConversations';
import { useLatestMessageAlert, useMarkNotificationRead, useMyNotifications } from '@/hooks/useNotifications';
import { MessageAlertCard } from '@/components/screens/MessageAlertCard';
import { formatDateShort, formatTime } from '@/utils/date';
import { currencyOf, formatMoney } from '@/utils/money';
import { customerCodeVisibility } from '@/utils/bookingPhase';
import { formatShipmentRoute } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS } from '@/utils/tripStatusLabels';
import { recentSearchesStorage, formatRecentSearch, type RecentSearch } from '@/services/storage/recentSearches';
import type { AppNotification } from '@/types/notifications.types';
import type { Booking, BookingStatus } from '@/types/bookings.types';
import type { Shipment } from '@/types/shipments.types';

const UPCOMING_TRIP_STATUSES = new Set([
  'PUBLISHED',
  'BOOKING_PENDING',
  'CONFIRMED',
  'DRIVER_ARRIVED',
  'PASSENGER_PICKED_UP',
  'IN_PROGRESS',
  // Le conducteur est arrivé mais la dépose n'est pas validée : le trajet n'est PAS fini, le client doit encore donner son code.
  'ARRIVED',
]);
const ACTIVITY_COUNT = 5;

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
};

/**
 * Ce que le client doit encore payer : réservations en attente de paiement + envois créés mais pas payés. Un seul total si tout est
 * dans la même devise ; sinon (ou si une devise manque) on n'additionne pas des monnaies différentes et on compte les éléments.
 */
function pendingPayments(bookings: Booking[], shipments: Shipment[]): { value: string; hint: string } {
  const lines: { amount: number; currency: string | undefined }[] = [
    ...bookings
      .filter((booking) => booking.status === 'PENDING_PAYMENT')
      .map((booking) => ({ amount: Number(booking.totalAmount), currency: currencyOf(booking) })),
    ...shipments
      .filter((shipment) => shipment.status === 'CREATED')
      .map((shipment) => ({ amount: Number(shipment.totalAmount), currency: shipment.currency?.isoCode })),
  ];

  if (lines.length === 0) return { value: 'Aucun', hint: 'Tout est réglé' };

  const currencies = new Set(lines.map((line) => line.currency));
  const [onlyCurrency] = currencies;
  if (currencies.size === 1 && onlyCurrency) {
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return { value: formatMoney(total, onlyCurrency), hint: lines.length > 1 ? `${lines.length} paiements à régler` : 'À régler' };
  }
  return { value: String(lines.length), hint: lines.length > 1 ? 'paiements à régler' : 'paiement à régler' };
}

export default function CustomerHomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useCustomerProfile();
  const { data: bookingsPage } = useMyBookings();
  const { data: shipmentsPage } = useMyShipments();
  // Pas d'endpoint compteur dédié — approximation à partir de la première
  // page de notifications, comme sur l'accueil conducteur.
  const { data: notificationsPage, isLoading: notificationsLoading } = useMyNotifications(1);
  const messageAlert = useLatestMessageAlert();
  const markNotificationRead = useMarkNotificationRead();
  const getOrCreateConversation = useGetOrCreateConversationForBooking();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);

  // Une recherche faite puis annulée doit réapparaître dès le retour sur l'accueil.
  useFocusEffect(
    useCallback(() => {
      recentSearchesStorage.getAll().then(setRecentSearches);
    }, []),
  );

  const bookings = bookingsPage?.data ?? [];
  const shipments = shipmentsPage?.data ?? [];
  const notifications = notificationsPage?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '…';

  const currentBookings = bookings
    .filter((booking) => (booking.status === 'PAID' || booking.status === 'CONFIRMED') && booking.trip && UPCOMING_TRIP_STATUSES.has(booking.trip.status))
    .sort((a, b) => new Date(a.trip!.departureAt).getTime() - new Date(b.trip!.departureAt).getTime());
  const current = currentBookings[0];
  // Quel code le client doit-il donner maintenant ? Le bouton de la carte y mène directement (pas besoin de passer par « Trajets »).
  const currentCodes = current?.trip ? customerCodeVisibility(current, current.trip.status) : { pickup: false, dropoff: false };
  const currentPrimaryLabel = currentCodes.dropoff
    ? 'Voir mon code de dépose'
    : currentCodes.pickup
      ? 'Voir mon code de prise en charge'
      : 'Voir la réservation';
  const currentStatusLabel = currentCodes.dropoff ? 'Arrivé' : current?.status === 'PAID' ? 'Payée' : 'Confirmée';
  // La liste ne contient pas les adresses ; le détail du trajet, si : c'est lui qui donne les coordonnées de la carte.
  const { data: currentTripDetail } = useTrip(current?.tripId);
  const currentTrip = current?.trip && currentTripDetail && currentTripDetail.id === current.tripId
    ? { ...current.trip, ...currentTripDetail }
    : current?.trip;
  const pending = pendingPayments(bookings, shipments);

  function openSearch() {
    router.push('/(customer)/trip-search');
  }

  function openShipmentFlow() {
    router.push('/(customer)/shipment-new');
  }

  function openNotification(notification: AppNotification) {
    if (!notification.readAt) markNotificationRead.mutate(notification.id);
    const conversationId = notification.payload?.conversationId;
    if (notification.type === 'CONVERSATION_MESSAGE' && typeof conversationId === 'string') {
      router.push(`/(customer)/conversation/${conversationId}`);
    } else {
      router.push('/(customer)/notifications');
    }
  }

  const activityItems: ActivityItem[] = sortActivity(
    [
      ...notifications.map((notification) => notificationToActivity(notification, () => openNotification(notification))),
      ...bookings
        .filter((booking) => booking.trip)
        .map((booking): ActivityItem => ({
          key: `b-${booking.id}`,
          icon: IconRoute,
          tone: booking.status === 'DISPUTED' ? 'danger' : 'ocean',
          title: `Réservation · ${BOOKING_STATUS_LABELS[booking.status]}`,
          text: `${booking.trip!.originCity.name} → ${booking.trip!.destinationCity.name} · ${formatDateShort(booking.trip!.departureAt)}`,
          at: booking.createdAt,
          onPress: () => router.push(`/(customer)/booking/${booking.id}`),
        })),
      ...shipments.map((shipment): ActivityItem => ({
        key: `s-${shipment.id}`,
        icon: IconPackage,
        tone: 'gold',
        title: `Colis · ${SHIPMENT_STATUS_LABELS[shipment.status]}`,
        text: formatShipmentRoute(shipment) ?? shipment.recipientName,
        at: shipment.createdAt,
        onPress: () => router.push(`/(customer)/shipment/${shipment.id}`),
      })),
      ...recentSearches.map((search): ActivityItem => ({
        key: `r-${search.originCityId ?? 'all'}-${search.destinationCityId ?? 'all'}`,
        icon: IconClockSearch,
        tone: 'ocean',
        title: 'Recherche de trajet',
        text: formatRecentSearch(search),
        at: search.searchedAt,
        onPress: () =>
          router.push({
            pathname: '/(customer)/trip-results',
            params: {
              originCityId: search.originCityId,
              originCityName: search.originCityName,
              destinationCityId: search.destinationCityId,
              destinationCityName: search.destinationCityName,
            },
          }),
      })),
    ],
    ACTIVITY_COUNT,
  );

  function contactDriver(bookingId: string) {
    setContactError(null);
    getOrCreateConversation.mutate(bookingId, {
      onSuccess: (conversation) => router.push(`/(customer)/conversation/${conversation.id}`),
      onError: () => setContactError('La conversation avec le conducteur n’a pas pu s’ouvrir. Réessayez dans un instant.'),
    });
  }

  return (
    <View style={styles.root}>
      <ScreenContainer scroll padded={false} edges={['bottom']}>
        <HomeHero
          firstName={profile?.firstName}
          lastName={profile?.lastName}
          initials={initials}
          photoUri={profile?.photoUrl}
          isVerified={Boolean(user?.isPhoneVerified)}
          unreadCount={unreadCount}
          onPressAvatar={() => router.navigate('/(customer)/(tabs)/profile')}
          onPressNotifications={() => router.push('/(customer)/notifications')}
        />

        <DashboardCard
          main={{
            label: 'À payer',
            value: pending.value,
            hint: pending.hint,
            onPress: () => router.navigate('/(customer)/(tabs)/trips'),
          }}
          stats={[
            { label: 'Vos trajets', value: bookingsPage ? String(bookingsPage.meta.total) : '—' },
            { label: 'Vos colis', value: shipmentsPage ? String(shipmentsPage.meta.total) : '—' },
          ]}
        />

        <HomeSearchBar
          placeholder="Rechercher un trajet, un colis ou un chauffeur"
          onPress={() => router.push('/(customer)/search')}
        />

        <View style={styles.content}>
          {contactError ? (
            <View style={styles.block}>
              <FeedbackBanner tone="error" title="Message indisponible" text={contactError} onDismiss={() => setContactError(null)} />
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
                    router.push(`/(customer)/conversation/${conversationId}`);
                  } else {
                    router.push('/(customer)/(tabs)/messages');
                  }
                }}
              />
            </View>
          ) : null}

          <View style={styles.tileRow}>
            <Pressable onPress={openSearch} style={[styles.tile, { backgroundColor: OCEAN.base }]}>
              <View style={styles.tileIllustration}>
                <TripTileIllustration />
              </View>
              <AppText variant="base" weight="semibold" color={OCEAN.onDark} style={styles.tileTitle}>
                Trouver un trajet
              </AppText>
              <AppText variant="xs" color={OCEAN.onDark} style={styles.tileSubtitle}>
                Réserver une place
              </AppText>
            </Pressable>
            <Pressable onPress={openShipmentFlow} style={[styles.tile, { backgroundColor: colors.accent }]}>
              <View style={styles.tileIllustration}>
                <ShipmentTileIllustration />
              </View>
              <AppText variant="base" weight="semibold" color={colors.onAccent} style={styles.tileTitle}>
                Envoyer un colis
              </AppText>
              <AppText variant="xs" color={colors.onAccent} style={styles.tileSubtitle}>
                Expédition rapide et sécurisée.
              </AppText>
            </Pressable>
          </View>

          <HomeSectionTitle
            title="Vos trajets en cours"
            actionLabel={currentBookings.length > 1 ? `Voir tout (${currentBookings.length})` : 'Voir tout'}
            onPressAction={() => router.navigate('/(customer)/(tabs)/trips')}
          />
          <View style={styles.block}>
            {current && currentTrip ? (
              <CurrentTripCard
                eyebrow="Trajet partagé"
                originName={currentTrip.originCity.name}
                destinationName={currentTrip.destinationCity.name}
                origin={routePoint(currentTrip.originLocation, currentTrip.originCity)}
                destination={routePoint(currentTrip.destinationLocation, currentTrip.destinationCity)}
                columns={[
                  { label: 'Date', value: `${formatDateShort(currentTrip.departureAt)} · ${formatTime(currentTrip.departureAt)}` },
                  { label: 'Places', value: String(current.seatsCount) },
                  { label: 'Statut', value: currentStatusLabel },
                  { label: 'Prix', value: formatMoney(current.totalAmount, currencyOf(current)) },
                ]}
                primary={{ label: currentPrimaryLabel, onPress: () => router.push(`/(customer)/booking/${current.id}`) }}
                secondary={{
                  label: 'Contacter le chauffeur',
                  onPress: () => contactDriver(current.id),
                  loading: getOrCreateConversation.isPending,
                }}
                onPress={() => router.push(`/(customer)/booking/${current.id}`)}
              />
            ) : (
              <OceanEmpty
                icon={<IconRoute size={28} color={OCEAN.base} />}
                title="Aucun trajet en cours"
                text="Vos réservations payées ou confirmées apparaîtront ici."
                action={<OceanButton label="Trouver un trajet" onPress={openSearch} style={styles.emptyButton} />}
              />
            )}
          </View>

          <HomeSectionTitle
            title="Activité récente"
            actionLabel="Mon activité"
            onPressAction={() => router.navigate('/(customer)/(tabs)/trips')}
          />
          <RecentActivity
            items={activityItems}
            isLoading={notificationsLoading}
            onPressAll={() => router.push('/(customer)/notifications')}
          />
        </View>
      </ScreenContainer>

      <HomeFab
        actions={[
          { label: 'Trouver un trajet', icon: <IconRoute size={20} color={OCEAN.base} />, onPress: openSearch },
          { label: 'Envoyer un colis', icon: <IconSend size={20} color={OCEAN.goldInk} />, onPress: openShipmentFlow },
          { label: 'Suivre un colis', icon: <IconPackage size={20} color={OCEAN.base} />, onPress: () => router.push('/suivi' as never) },
          { label: 'Rechercher', icon: <IconSearch size={20} color={OCEAN.base} />, onPress: () => router.push('/(customer)/search') },
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
  tileTitle: {
    marginTop: spacing.md,
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