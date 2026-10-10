// mobile/src/utils/maps.ts
import { Linking, Platform } from 'react-native';

/** Ouvre l'appli Plans native (Apple Plans / Google Maps) plutôt que d'intégrer une bibliothèque de cartes — évite une dépendance native de plus (clé API Google Maps, configuration native) pour un simple "voir où il est". */
export async function openInMaps(latitude: number, longitude: number, label = 'Conducteur'): Promise<void> {
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
