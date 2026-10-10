// mobile/src/components/screens/TicketScanner.tsx
// [11/10/2026] v1 — Scanner de billets et d'étiquettes (conducteur). Un bouton ouvre la caméra plein écran ; le QR code lu est envoyé au serveur,
// qui répond « authentique ? concerne-t-il l'un de MES trajets / envois ? » (le code ne contient jamais le code OTP). Le résultat s'affiche en
// grand (vert / rouge) avec le nom des passagers ou le colis. Sur le web, la caméra n'est pas fiable : on le dit clairement au lieu de planter.
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { IconCircleCheck, IconCircleX, IconQrcode, IconX } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ApiError } from '@/services/api/ApiError';
import { useScanTicket } from '@/hooks/useScanTicket';
import type { TicketScanResult } from '@/types/safety.types';
import { formatDateLong } from '@/utils/date';

function ResultCard({ result }: { result: TicketScanResult }) {
  const ok = result.valid;
  const booking = result.booking;
  const parcel = result.parcel;
  return (
    <OceanCard style={[styles.result, ok ? styles.resultOk : styles.resultKo]}>
      <View style={styles.resultTop}>
        {ok ? <IconCircleCheck size={34} color={colors.success} /> : <IconCircleX size={34} color={colors.danger} />}
        <View style={styles.flex}>
          <AppText variant="lg" weight="bold" color={ok ? 'success' : 'danger'}>
            {ok ? 'Billet valide' : 'Billet refusé'}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {result.message}
          </AppText>
        </View>
      </View>

      {booking ? (
        <View style={styles.details}>
          <AppText variant="sm" weight="semibold">
            {booking.from} → {booking.to}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {formatDateLong(booking.departureAt)} · Réf. {booking.reference}
          </AppText>
          <AppText variant="sm">
            {booking.passengers.length > 0 ? booking.passengers.join(', ') : 'Passager'} · {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
          </AppText>
        </View>
      ) : null}

      {parcel ? (
        <View style={styles.details}>
          <AppText variant="sm" weight="semibold">
            Colis {parcel.parcelNumber}/{parcel.parcelCount} · {parcel.category}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {parcel.from} → {parcel.to} · {parcel.weightKg} kg
          </AppText>
          <AppText variant="sm">Destinataire : {parcel.recipientName}</AppText>
          <AppText variant="xs" color="textSecondary">
            N° {parcel.trackingNumber}
          </AppText>
        </View>
      ) : null}
    </OceanCard>
  );
}

export function TicketScanButton({ label = 'Scanner un billet' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OceanButton label={label} variant="outline" icon={<IconQrcode size={18} color={OCEAN.base} />} onPress={() => setOpen(true)} />
      <TicketScannerModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function TicketScannerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useScanTicket();
  const [result, setResult] = useState<TicketScanResult | null>(null);
  const [errorText, setErrorText] = useState<string | undefined>();
  // La caméra relit le même QR plusieurs fois par seconde : on ne traite qu'un code à la fois.
  const busy = useRef(false);
  const isWeb = Platform.OS === 'web';

  const reset = useCallback(() => {
    busy.current = false;
    setResult(null);
    setErrorText(undefined);
  }, []);

  function close() {
    reset();
    onClose();
  }

  function handleScanned({ data }: { data: string }) {
    if (busy.current) return;
    busy.current = true;
    setErrorText(undefined);
    scan.mutate(data, {
      onSuccess: (response) => setResult(response),
      onError: (error) => {
        setErrorText(error instanceof ApiError ? error.message : 'Impossible de contrôler ce billet. Vérifiez votre connexion puis réessayez.');
        busy.current = false;
      },
    });
  }

  let body: React.ReactNode;
  if (isWeb) {
    body = (
      <View style={styles.center}>
        <IconQrcode size={44} color={OCEAN.base} />
        <AppText variant="base" weight="bold" style={styles.centerText}>
          Scan disponible sur l’application mobile
        </AppText>
        <AppText variant="sm" color="textSecondary" style={styles.centerText}>
          Ouvrez Occa’Z sur votre téléphone pour scanner les billets et les étiquettes.
        </AppText>
      </View>
    );
  } else if (!permission) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={OCEAN.base} />
      </View>
    );
  } else if (!permission.granted) {
    body = (
      <View style={styles.center}>
        <IconQrcode size={44} color={OCEAN.base} />
        <AppText variant="base" weight="bold" style={styles.centerText}>
          Autoriser la caméra
        </AppText>
        <AppText variant="sm" color="textSecondary" style={styles.centerText}>
          La caméra sert uniquement à lire le QR code des billets et des étiquettes. Rien n’est enregistré.
        </AppText>
        {permission.canAskAgain ? (
          <OceanButton label="Autoriser" onPress={() => void requestPermission()} />
        ) : (
          <AppText variant="sm" color="textSecondary" style={styles.centerText}>
            L’accès à la caméra est refusé. Autorisez-le dans les réglages de votre téléphone, puis revenez ici.
          </AppText>
        )}
      </View>
    );
  } else if (result) {
    body = (
      <View style={styles.resultWrap}>
        <ResultCard result={result} />
        <OceanButton label="Scanner un autre billet" onPress={reset} />
        <OceanButton label="Fermer" variant="outline" onPress={close} />
      </View>
    );
  } else {
    body = (
      <View style={styles.flex}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scan.isPending ? undefined : handleScanned}
        />
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
        </View>
        <View style={styles.bottom}>
          {scan.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText variant="sm" weight="semibold" color="#fff" style={styles.centerText}>
              Placez le QR code du billet dans le cadre
            </AppText>
          )}
          {errorText ? <FeedbackBanner tone="error" text={errorText} onDismiss={reset} /> : null}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <AppText variant="lg" weight="bold" color="#fff">
            Contrôler un billet
          </AppText>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fermer le scanner" hitSlop={12}>
            <IconX size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.body}>{body}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: OCEAN.deep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  body: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { textAlign: 'center' },
  frameWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: '#fff' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.45)' },
  resultWrap: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  result: { gap: spacing.sm, padding: spacing.md },
  resultOk: { borderColor: colors.success, backgroundColor: colors.successLight },
  resultKo: { borderColor: colors.danger, backgroundColor: '#FDE8E8' },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  details: { gap: 2, paddingTop: spacing.xs },
});
