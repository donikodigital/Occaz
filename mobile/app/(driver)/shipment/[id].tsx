// mobile/app/(driver)/shipment/[id].tsx
//
// [03/10/2026] v3 — Page refaite dans le style bleu océan du reste de l'app. Un bandeau en tête réunit l'essentiel : statut,
// itinéraire « Dakar → Koundara », gain net et période. L'expéditeur et le destinataire ont chacun leur carte (nom, adresse,
// appel / SMS). La prochaine étape est annoncée avant le bouton qui la déclenche. Tous les parcours sont conservés : récupération
// et livraison avec code, annulation avant récupération, signalement d'un problème.
//
// Colis livré sans litige (DELIVERED / COMPLETED) : plus d'appel ni de SMS vers l'expéditeur et le destinataire, et plus de
// messagerie. Le serveur ne renvoie d'ailleurs plus leurs numéros (voir hideContactsOnceDelivered) ; si un litige s'ouvre
// (DISPUTED), les contacts reviennent le temps de le régler.
//
// v2 — gain net et période affichés, téléphones appelables, annulation avant récupération seulement ; l'attribution se fait
// depuis la liste.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCalendarEvent,
  IconLifebuoy,
  IconLock,
  IconMapPin,
  IconMessageCircle,
  IconPackage,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { ContactRow } from '@/components/screens/ContactRow';
import { OceanButton, OceanCard, OceanPill, OceanScreenHeader, OceanSection, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useShipment, useCancelShipment } from '@/hooks/useShipments';
import {
  useMarkShipmentPickupPending,
  useMarkShipmentInTransit,
  useMarkShipmentDeliveryPending,
  useRequestShipmentPickupOtp,
  useVerifyShipmentPickupOtp,
  useRequestShipmentDeliveryOtp,
  useVerifyShipmentDeliveryOtp,
} from '@/hooks/useShipmentOtp';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatLocation, formatWindow } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE } from '@/utils/tripStatusLabels';
import { useGetOrCreateConversationForShipment } from '@/hooks/useConversations';
import { ApiError } from '@/services/api/ApiError';
import type { Shipment, ShipmentStatus } from '@/types/shipments.types';

const HERO_MUTED = OCEAN.sky;
const HERO_SOFT = 'rgba(255,255,255,0.16)';

const TONE_TO_PILL: Record<'primary' | 'success' | 'danger' | 'neutral', OceanPillTone> = {
  primary: 'ocean',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

/** Ce que le conducteur doit faire ensuite — dit avant le bouton qui le déclenche. */
const NEXT_STEP: Partial<Record<ShipmentStatus, string>> = {
  DRIVER_ASSIGNED: "Rendez-vous à l'adresse de ramassage, puis signalez que vous êtes en route.",
  PICKUP_PENDING: "Sur place, demandez le code à l'expéditeur pour valider la récupération.",
  PICKED_UP: 'Colis récupéré : démarrez le transport quand vous êtes prêt.',
  IN_TRANSIT: 'Signalez que vous partez pour la livraison.',
  DELIVERY_PENDING: 'Sur place, demandez le code au destinataire pour valider la livraison.',
  DELIVERED: 'Livraison validée.',
  COMPLETED: 'Envoi terminé.',
  DISPUTED: 'Un litige est ouvert sur cet envoi.',
  CANCELLED: 'Cet envoi a été annulé.',
  REFUNDED: 'Cet envoi a été remboursé.',
};

/** La couleur du bandeau raconte l'état de l'envoi : bleu profond en cours, vert une fois livré, gris annulé, rouge litige. */
function heroColorFor(status: ShipmentStatus): string {
  if (status === 'DELIVERED' || status === 'COMPLETED') return colors.successDeep;
  if (status === 'DISPUTED') return colors.danger;
  if (status === 'CANCELLED' || status === 'REFUNDED') return '#5B6B7A';
  return OCEAN.deep;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Ville seule, ou ville + pays quand le serveur les a joints (détail d'un envoi). */
function cityOf(location: Shipment['senderLocation']): { city: string; country?: string } {
  const city = location?.city;
  return { city: city?.name ?? location?.label ?? '—', country: city?.country?.name };
}

// ---------------------------------------------------------------------------
// Code à saisir (récupération, livraison)
// ---------------------------------------------------------------------------

function OtpSection({
  title,
  onRequest,
  onVerify,
  isRequesting,
  isVerifying,
  supportPrompt,
  onContactSupport,
}: {
  title: string;
  onRequest: () => void;
  onVerify: (code: string) => void;
  isRequesting: boolean;
  isVerifying: boolean;
  /** Texte du bouton contextuel affiché une fois le code demandé (ex. « Expéditeur injoignable ? »). */
  supportPrompt: string;
  onContactSupport: () => void;
}) {
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');

  return (
    <OceanCard style={styles.otpCard}>
      <AppText variant="base" weight="semibold">
        {title}
      </AppText>
      {!codeVisible ? (
        <OceanButton
          label="Demander le code"
          variant="soft"
          onPress={() => {
            onRequest();
            setCodeVisible(true);
          }}
          loading={isRequesting}
        />
      ) : (
        <>
          <View style={styles.codeRow}>
            <TextField
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="Code à 6 chiffres"
              maxLength={6}
              // `style` ne touche que le <TextInput> interne, jamais son conteneur — d'où le champ resté étroit malgré
              // codeInput (flex: 1) : ce flex n'atteignait jamais l'élément qui partage la rangée avec « Vérifier ».
              containerStyle={styles.codeInput}
            />
            <OceanButton label="Vérifier" onPress={() => onVerify(code)} loading={isVerifying} disabled={code.length !== 6} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onContactSupport}
            style={({ pressed }) => [styles.supportLink, pressed && styles.pressed]}
          >
            <IconLifebuoy size={14} color={OCEAN.base} />
            <AppText variant="xs" color={OCEAN.base} weight="semibold">
              {supportPrompt}
            </AppText>
          </Pressable>
        </>
      )}
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Carte d'une personne (expéditeur / destinataire)
// ---------------------------------------------------------------------------

function PersonCard({
  role,
  name,
  location,
  phone,
}: {
  role: string;
  name: string;
  location: Shipment['senderLocation'];
  /** Absent une fois le colis livré : le serveur ne renvoie plus le numéro, les boutons disparaissent. */
  phone: string | null | undefined;
}) {
  return (
    <OceanCard style={styles.personCard}>
      <View style={styles.personHeader}>
        <View style={styles.avatar}>
          <AppText variant="sm" weight="bold" color={OCEAN.base}>
            {initialsOf(name) || '·'}
          </AppText>
        </View>
        <View style={styles.personText}>
          <AppText variant="xs" color="textSecondary">
            {role}
          </AppText>
          <AppText variant="base" weight="semibold" numberOfLines={1}>
            {name}
          </AppText>
        </View>
      </View>

      <View style={styles.addressRow}>
        <IconMapPin size={15} color={OCEAN.base} />
        <AppText variant="sm" color="textSecondary" style={styles.addressText}>
          {formatLocation(location)}
        </AppText>
      </View>

      {phone ? <ContactRow phone={phone} /> : null}
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function DriverShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);

  const cancelShipment = useCancelShipment(id ?? '');
  const getOrCreateConversation = useGetOrCreateConversationForShipment();
  const markPickupPending = useMarkShipmentPickupPending(id ?? '');
  const markInTransit = useMarkShipmentInTransit(id ?? '');
  const markDeliveryPending = useMarkShipmentDeliveryPending(id ?? '');
  const requestPickupOtp = useRequestShipmentPickupOtp(id ?? '');
  const verifyPickupOtp = useVerifyShipmentPickupOtp(id ?? '');
  const requestDeliveryOtp = useRequestShipmentDeliveryOtp(id ?? '');
  const verifyDeliveryOtp = useVerifyShipmentDeliveryOtp(id ?? '');

  if (isLoading || !shipment) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger cet envoi.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </ScreenContainer>
    );
  }

  // Une fois le colis récupéré, l'annulation n'est plus possible (le client serait remboursé à 100 % alors que le colis est en route) : le recours est « Signaler un problème ».
  const canCancel = ['DRIVER_ASSIGNED', 'PICKUP_PENDING'].includes(shipment.status);
  // Livré sans litige : plus aucun contact entre le conducteur et les clients (appel, SMS, messagerie).
  const contactsClosed = shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED';
  const currencyCode = shipment.currency?.isoCode;
  const from = cityOf(shipment.senderLocation);
  const to = cityOf(shipment.recipientLocation);
  const nextStep = NEXT_STEP[shipment.status];

  function handleCancel() {
    Alert.alert('Annuler cet envoi ?', "Le client sera remboursé intégralement et l'envoi sera annulé.", [
      { text: 'Retour', style: 'cancel' },
      {
        text: "Annuler l'envoi",
        style: 'destructive',
        onPress: () =>
          cancelShipment.mutate(
            { reason: "Annulé depuis l'application" },
            {
              onError: (error) =>
                Alert.alert('Erreur', error instanceof ApiError ? error.message : "L'annulation a échoué."),
            },
          ),
      },
    ]);
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title="Détail de l'envoi"
        subtitle={shipment.category?.name ?? 'Colis'}
        onBack={() => router.back()}
        right={
          shipment.driverId && !contactsClosed ? (
            <Pressable
              onPress={() =>
                getOrCreateConversation.mutate(shipment.id, {
                  onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Contacter le client"
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <IconMessageCircle size={18} color={OCEAN.base} />
            </Pressable>
          ) : undefined
        }
      />

      {/* Bandeau : statut, itinéraire, gain et période */}
      <View style={[styles.hero, { backgroundColor: heroColorFor(shipment.status) }]}>
        <View style={styles.decoLarge} />
        <View style={styles.decoSmall} />

        <View style={styles.heroTop}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
              {SHIPMENT_STATUS_LABELS[shipment.status]}
            </AppText>
          </View>
          <View style={styles.parcelChip}>
            <IconPackage size={13} color={colors.onPrimary} />
            <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
              {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
            </AppText>
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.rail}>
            <View style={styles.railDotFrom} />
            <View style={styles.railLine} />
            <View style={styles.railDotTo} />
          </View>
          <View style={styles.routeCities}>
            <View>
              <AppText variant="xs" color={HERO_MUTED}>
                Ramassage
              </AppText>
              <AppText variant="xl" weight="bold" color={colors.onPrimary} numberOfLines={1}>
                {from.city}
              </AppText>
              {from.country ? (
                <AppText variant="xs" color={HERO_MUTED}>
                  {from.country}
                </AppText>
              ) : null}
            </View>
            <View>
              <AppText variant="xs" color={HERO_MUTED}>
                Livraison
              </AppText>
              <AppText variant="xl" weight="bold" color={colors.onPrimary} numberOfLines={1}>
                {to.city}
              </AppText>
              {to.country ? (
                <AppText variant="xs" color={HERO_MUTED}>
                  {to.country}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <View>
            <AppText variant="xs" color={HERO_MUTED}>
              Vous recevrez
            </AppText>
            <AppText variant="xxl" weight="bold" color={colors.onPrimary}>
              {formatMoney(driverNetAmount(shipment), currencyCode)}
            </AppText>
          </View>
          <View style={styles.dateChip}>
            <IconCalendarEvent size={13} color={colors.onPrimary} />
            <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
              {formatWindow(shipment)}
            </AppText>
          </View>
        </View>
      </View>

      {nextStep ? (
        <View style={styles.nextStep}>
          <OceanPill label="Prochaine étape" tone={TONE_TO_PILL[SHIPMENT_STATUS_TONE[shipment.status]]} />
          <AppText variant="sm" color="textSecondary" style={styles.nextStepText}>
            {nextStep}
          </AppText>
        </View>
      ) : null}

      {/* Actions de l'étape en cours */}
      {shipment.status === 'DRIVER_ASSIGNED' ? (
        <OceanButton
          label="En route pour la récupération"
          onPress={() => markPickupPending.mutate()}
          loading={markPickupPending.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'PICKUP_PENDING' ? (
        <OtpSection
          title="Code de récupération"
          onRequest={() =>
            requestPickupOtp.mutate(undefined, {
              onSuccess: (result) => {
                if (!result.smsSent) {
                  Alert.alert(
                    'Code généré',
                    "Le SMS n'a pas pu être envoyé à l'expéditeur — demandez-lui de consulter son code directement dans l'application.",
                  );
                }
              },
            })
          }
          onVerify={(code) =>
            verifyPickupOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestPickupOtp.isPending}
          isVerifying={verifyPickupOtp.isPending}
          supportPrompt="Expéditeur injoignable ou refuse le code ? Contacter le support"
          onContactSupport={() =>
            router.push({
              pathname: '/(driver)/dispute-new',
              params: {
                subjectType: 'SHIPMENT',
                shipmentId: shipment.id,
                reason: 'Expéditeur injoignable ou refuse de communiquer le code de récupération',
                description: `Colis pour ${shipment.recipientName}.`,
              },
            })
          }
        />
      ) : null}

      {shipment.status === 'PICKED_UP' ? (
        <OceanButton
          label="Démarrer le transport"
          onPress={() => markInTransit.mutate()}
          loading={markInTransit.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'IN_TRANSIT' ? (
        <OceanButton
          label="En route pour la livraison"
          onPress={() => markDeliveryPending.mutate()}
          loading={markDeliveryPending.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'DELIVERY_PENDING' ? (
        <OtpSection
          title="Code de livraison"
          onRequest={() =>
            requestDeliveryOtp.mutate(undefined, {
              onSuccess: (result) => {
                if (!result.smsSent) {
                  Alert.alert(
                    'Code généré',
                    "Le SMS n'a pas pu être envoyé au destinataire — contrairement à l'expéditeur, il n'a pas de compte dans l'application pour le consulter autrement. Réessayez ou contactez-le directement.",
                  );
                }
              },
            })
          }
          onVerify={(code) =>
            verifyDeliveryOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestDeliveryOtp.isPending}
          isVerifying={verifyDeliveryOtp.isPending}
          supportPrompt="Destinataire injoignable ou refuse le code ? Contacter le support"
          onContactSupport={() =>
            router.push({
              pathname: '/(driver)/dispute-new',
              params: {
                subjectType: 'SHIPMENT',
                shipmentId: shipment.id,
                reason: 'Destinataire injoignable ou refuse de communiquer le code de livraison',
                description: `Colis de ${shipment.senderName} pour ${shipment.recipientName}.`,
              },
            })
          }
        />
      ) : null}

      {/* Expéditeur et destinataire */}
      <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title="Personnes concernées">
        <View style={styles.people}>
          <PersonCard
            role="Expéditeur"
            name={shipment.senderName}
            location={shipment.senderLocation}
            phone={contactsClosed ? null : shipment.senderPhone}
          />
          <PersonCard
            role="Destinataire"
            name={shipment.recipientName}
            location={shipment.recipientLocation}
            phone={contactsClosed ? null : shipment.recipientPhone}
          />
        </View>

        {contactsClosed ? (
          <View style={styles.lockedNote}>
            <IconLock size={16} color={OCEAN.base} />
            <AppText variant="xs" color="textSecondary" style={styles.lockedText}>
              Colis livré : les coordonnées de l'expéditeur et du destinataire ne sont plus accessibles. En cas de problème,
              utilisez « Signaler un problème ».
            </AppText>
          </View>
        ) : null}
      </OceanSection>

      {canCancel ? (
        <OceanButton
          label="Annuler l'envoi"
          variant="outline"
          onPress={handleCancel}
          loading={cancelShipment.isPending}
          style={styles.actionButton}
        />
      ) : null}

      <OceanButton
        label="Signaler un problème"
        variant="outline"
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: { subjectType: 'SHIPMENT', shipmentId: shipment.id },
          })
        }
        style={styles.actionButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },

  // Bandeau
  hero: {
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  decoLarge: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: HERO_SOFT,
  },
  decoSmall: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: HERO_SOFT,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },
  parcelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: HERO_SOFT,
  },
  route: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  railDotFrom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.onPrimary,
  },
  railLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  railDotTo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: OCEAN.gold,
    backgroundColor: 'transparent',
  },
  routeCities: {
    flex: 1,
    gap: spacing.lg,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: HERO_SOFT,
  },

  // Prochaine étape
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nextStepText: {
    flex: 1,
  },
  actionButton: {
    marginBottom: spacing.md,
  },

  // Code à saisir
  otpCard: {
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  codeInput: {
    flex: 1,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },

  // Personnes
  people: {
    gap: spacing.sm,
  },
  personCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  personText: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
  },
  lockedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: OCEAN.mist,
  },
  lockedText: {
    flex: 1,
  },
});
