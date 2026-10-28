// mobile/app/(customer)/notifications.tsx
// [28/10/2026] v+ — Ne montre que les notifications de l'espace client.
import { NotificationsInboxScreen } from '@/components/screens/NotificationsInboxScreen';

export default function CustomerNotificationsScreen() {
  return <NotificationsInboxScreen space="CUSTOMER" />;
}
