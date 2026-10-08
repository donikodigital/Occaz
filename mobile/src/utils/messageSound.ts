// mobile/src/utils/messageSound.ts
//
// Son des messages reçus dans une conversation (client ↔ conducteur, support). Ce n'est PAS le son des notifications : les autres
// alertes (paiement, litige, demande d'envoi…) gardent leur son habituel, seuls les messages d'échange ont ce petit « tin-ding ».
//
// - Le son se joue quand l'application est ouverte ; en arrière-plan, c'est le canal « Messages » de la notification qui le joue
//   (voir usePushNotifications).
// - Il respecte le mode silencieux et le volume du téléphone, et ne coupe pas la musique en cours.
// - Un seul son à la fois : deux arrivées à moins de 1,5 s (push + actualisation de la liste) ne le jouent qu'une fois.
// - Jamais bloquant : si l'audio est indisponible (web sans interaction, appareil sans son), on se tait en silence.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MESSAGE_SOUND = require('../../assets/sounds/message.wav');

const MIN_GAP_MS = 1500;

let player: AudioPlayer | null = null;
let lastPlayedAt = 0;
let modeReady = false;
let activeConversationId: string | null = null;

/** Conversation actuellement affichée à l'écran : un message qui y arrive ne s'annonce pas par une bannière. */
export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export async function playMessageSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  try {
    if (!modeReady) {
      modeReady = true;
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    }
    if (!player) player = createAudioPlayer(MESSAGE_SOUND);
    await player.seekTo(0);
    player.play();
  } catch {
    // Silencieux par nature : un son manqué n'est jamais aussi grave qu'un écran cassé.
  }
}
