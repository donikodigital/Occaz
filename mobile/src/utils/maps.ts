// mobile/src/utils/maps.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import { Linking, Platform } from 'react-native';
import { translate } from '@/i18n';

/** Ouvre l'appli Plans native (Apple Plans / Google Maps) plutôt que d'intégrer une bibliothèque de cartes — évite une dépendance native de plus (clé API Google Maps, configuration native) pour un simple "voir où il est". */
export async function openInMaps(latitude: number, longitude: number, label = translate('Conducteur')): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? `maps://?q=${encodeURIComponent(label)}&ll=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;

  const canOpenNative = await Linking.canOpenURL(url);
  if (canOpenNative) {
    await Linking.openURL(url);
    return;
  }
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
}
