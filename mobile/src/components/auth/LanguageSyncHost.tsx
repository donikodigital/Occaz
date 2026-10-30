// mobile/src/components/auth/LanguageSyncHost.tsx
// [30/10/2026] v1 — Dit au serveur la langue choisie dans l'app, pour qu'il écrive dans cette langue les notifications, SMS et e-mails
// qu'il envoie hors d'une requête. Se déclenche à la connexion et à chaque changement de langue ; ne fait rien si le compte est déjà
// à jour. Un échec (réseau coupé) est sans conséquence : l'envoi est retenté au prochain lancement.
import { useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { usersApi } from '@/services/api/users.api';

export function LanguageSyncHost() {
  const language = useLanguage();
  const userId = useAuthStore((state) => state.user?.id);
  const storedLanguage = useAuthStore((state) => state.user?.language);
  const updateUser = useAuthStore((state) => state.updateUser);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      lastSent.current = null;
      return;
    }
    if (storedLanguage === language) return;
    const signature = `${userId}|${language}`;
    if (lastSent.current === signature) return;
    lastSent.current = signature;
    usersApi
      .updateMe({ language })
      .then((user) => updateUser(user))
      .catch(() => {
        lastSent.current = null;
      });
  }, [language, userId, storedLanguage, updateUser]);

  return null;
}
