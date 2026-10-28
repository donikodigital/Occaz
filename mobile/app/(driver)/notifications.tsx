// mobile/app/(driver)/notifications.tsx
// [28/10/2026] v+ — Ne montre que les notifications de l'espace conducteur.
import { NotificationsInboxScreen } from '@/components/screens/NotificationsInboxScreen';

export default function DriverNotificationsScreen() {
  return <NotificationsInboxScreen space="DRIVER" />;
}
