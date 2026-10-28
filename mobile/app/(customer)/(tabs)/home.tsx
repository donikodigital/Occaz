// mobile/app/(customer)/(tabs)/home.tsx
// [28/10/2026] v+ — Notifications et alerte de message limitées à l'espace client.
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v+ — carte « Détails du trajet » : le statut (« Confirmée ») et le prix (« 253 000 GNF ») tiennent sur une seule ligne.
// [19/10/2026] v+ — rappel d'ajouter une adresse e-mail (carte facultative, affichée tant qu'aucune adresse n'est vérifiée).
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
import { AddEmailReminderCard } from '@/components/screens/AddEmailReminderCard';
import { formatDateShort, formatTime } from '@/utils/date';
import { currencyOf, formatMoney } from '@/utils/money';
import { customerCodeVisibility } from '@/utils/bookingPhase';
import { formatShipmentRoute } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS } from '@/utils/tripStatusLabels';
import { recentSearchesStorage, formatRecentSearch, type RecentSearch } from '@/services/storage/recentSearches';
import type { AppNotification } from '@/types/notifications.types';
import type { Booking, BookingStatus } from '@/types/bookings.types';
import type { Shipment } from '@/types/shipments.types';
import { useT, translate } from '@/i18n';

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
  get PENDING_PAYMENT() { return translate('En attente de paiement'); },
  get PAID() { return translate('Payée'); },
  get CONFIRMED() { return translate('Confirmée'); },
  get CANCELLED() { return translate('Annulée'); },
  get COMPLETED() { return translate('Terminée'); },
  get REFUNDED() { return translate('Remboursée'); },
  get DISPUTED() { return translate('En litige'); },
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

  if (lines.length === 0) return { value: translate('Aucun'), hint: translate('Tout est réglé') };

  const currencies = new Set(lines.map((line) => line.currency));
  const [onlyCurrency] = currencies;
  if (currencies.size === 1 && onlyCurrency) {
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return { value: formatMoney(total, onlyCurrency), hint: lines.length > 1 ? translate('{linesLength} paiements à régler', { linesLength: lines.length }) : translate('À régler') };
  }
  return { value: String(lines.length), hint: lines.length > 1 ? translate('paiements à régler') : translate('paiement à régler') };
}

export default function CustomerHomeScreen() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useCustomerProfile();
  const { data: bookingsPage } = useMyBookings();
  const { data: shipmentsPage } = useMyShipments();
  // Pas d'endpoint compteur dédié — approximation à partir de la première
  // page de notifications, comme sur l'accueil conducteur.
  const { data: notificationsPage, isLoading: notificationsLoading } = useMyNotifications(1, 'CUSTOMER');
  const messageAlert = useLatestMessageAlert('CUSTOMER');
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
    ? t('Voir mon code de dépose')
    : currentCodes.pickup
      ? t('Voir mon code de prise en charge')
      : t('Voir la réservation');
  const currentStatusLabel = currentCodes.dropoff ? t('Arrivé') : current?.status === 'PAID' ? t('Payée') : t('Confirmée');
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
          title: t('Réservation · {status}', { status: BOOKING_STATUS_LABELS[booking.status] }),
          text: `${booking.trip!.originCity.name} → ${booking.trip!.destinationCity.name} · ${formatDateShort(booking.trip!.departureAt)}`,
          at: booking.createdAt,
          onPress: () => router.push(`/(customer)/booking/${booking.id}`),
        })),
      ...shipments.map((shipment): ActivityItem => ({
        key: `s-${shipment.id}`,
        icon: IconPackage,
        tone: 'gold',
        title: t('Colis · {status}', { status: SHIPMENT_STATUS_LABELS[shipment.status] }),
        text: formatShipmentRoute(shipment) ?? shipment.recipientName,
        at: shipment.createdAt,
        onPress: () => router.push(`/(customer)/shipment/${shipment.id}`),
      })),
      ...recentSearches.map((search): ActivityItem => ({
        key: `r-${search.originCityId ?? 'all'}-${search.destinationCityId ?? 'all'}`,
        icon: IconClockSearch,
        tone: 'ocean',
        title: t('Recherche de trajet'),
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
      onError: () => setContactError(t('La conversation avec le conducteur n’a pas pu s’ouvrir. Réessayez dans un instant.')),
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
            label: t('À payer'),
            value: pending.value,
            hint: pending.hint,
            onPress: () => router.navigate('/(customer)/(tabs)/trips'),
          }}
          stats={[
            { label: t('Vos trajets'), value: bookingsPage ? String(bookingsPage.meta.total) : '—' },
            { label: t('Vos colis'), value: shipmentsPage ? String(shipmentsPage.meta.total) : '—' },
          ]}
        />

        <HomeSearchBar
          placeholder={t('Rechercher un trajet, un colis ou un chauffeur')}
          onPress={() => router.push('/(customer)/search')}
        />

        <View style={styles.content}>
          {contactError ? (
            <View style={styles.block}>
              <FeedbackBanner tone="error" title={t('Message indisponible')} text={contactError} onDismiss={() => setContactError(null)} />
            </View>
          ) : null}
          <AddEmailReminderCard space="CUSTOMER" />
          {messageAlert ? (
            <View style={styles.block}>
              <MessageAlertCard
                senderName={messageAlert.title ?? t('Nouveau message')}
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
                {t('Trouver un trajet')}
              </AppText>
              <AppText variant="xs" color={OCEAN.onDark} style={styles.tileSubtitle}>
                {t('Réserver une place')}
              </AppText>
            </Pressable>
            <Pressable onPress={openShipmentFlow} style={[styles.tile, { backgroundColor: colors.accent }]}>
              <View style={styles.tileIllustration}>
                <ShipmentTileIllustration />
              </View>
              <AppText variant="base" weight="semibold" color={colors.onAccent} style={styles.tileTitle}>
                {t('Envoyer un colis')}
              </AppText>
              <AppText variant="xs" color={colors.onAccent} style={styles.tileSubtitle}>
                {t('Expédition rapide et sécurisée.')}
              </AppText>
            </Pressable>
          </View>

          <HomeSectionTitle
            title={t('Vos trajets en cours')}
            actionLabel={currentBookings.length > 1 ? t('Voir tout ({currentBookingsLength})', { currentBookingsLength: currentBookings.length }) : t('Voir tout')}
            onPressAction={() => router.navigate('/(customer)/(tabs)/trips')}
          />
          <View style={styles.block}>
            {current && currentTrip ? (
              <CurrentTripCard
                eyebrow={t('Trajet partagé')}
                originName={currentTrip.originCity.name}
                destinationName={currentTrip.destinationCity.name}
                origin={routePoint(currentTrip.originLocation, currentTrip.originCity)}
                destination={routePoint(currentTrip.destinationLocation, currentTrip.destinationCity)}
                columns={[
                  { label: t('Date'), value: `${formatDateShort(currentTrip.departureAt)} · ${formatTime(currentTrip.departureAt)}` },
                  { label: t('Places'), value: String(current.seatsCount), flex: 0.6 },
                  // « Confirmée » et « 253 000 GNF » restent chacun sur une seule ligne.
                  { label: t('Statut'), value: currentStatusLabel, flex: 1.15, singleLine: true },
                  { label: t('Prix'), value: formatMoney(current.totalAmount, currencyOf(current)), flex: 1.35, singleLine: true },
                ]}
                primary={{ label: currentPrimaryLabel, onPress: () => router.push(`/(customer)/booking/${current.id}`) }}
                secondary={{
                  label: t('Contacter le chauffeur'),
                  onPress: () => contactDriver(current.id),
                  loading: getOrCreateConversation.isPending,
                }}
                onPress={() => router.push(`/(customer)/booking/${current.id}`)}
              />
            ) : (
              <OceanEmpty
                icon={<IconRoute size={28} color={OCEAN.base} />}
                title={t('Aucun trajet en cours')}
                text={t('Vos réservations payées ou confirmées apparaîtront ici.')}
                action={<OceanButton label={t('Trouver un trajet')} onPress={openSearch} style={styles.emptyButton} />}
              />
            )}
          </View>

          <HomeSectionTitle
            title={t('Activité récente')}
            actionLabel={t('Mon activité')}
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
          { label: t('Trouver un trajet'), icon: <IconRoute size={20} color={OCEAN.base} />, onPress: openSearch },
          { label: t('Envoyer un colis'), icon: <IconSend size={20} color={OCEAN.goldInk} />, onPress: openShipmentFlow },
          { label: t('Suivre un colis'), icon: <IconPackage size={20} color={OCEAN.base} />, onPress: () => router.push('/suivi' as never) },
          { label: t('Rechercher'), icon: <IconSearch size={20} color={OCEAN.base} />, onPress: () => router.push('/(customer)/search') },
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