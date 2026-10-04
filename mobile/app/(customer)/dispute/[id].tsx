// mobile/app/(customer)/dispute/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { DisputeDetailScreen } from '@/components/screens/DisputeDetailScreen';
import { closeToHome } from '@/utils/navigation';

export default function CustomerDisputeDetailScreen() {
  // `created` : page affichée juste après la création du signalement → croix « Fermer » qui revient à l'accueil.
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <DisputeDetailScreen disputeId={id} onClose={created ? () => closeToHome('/(customer)/(tabs)/home') : undefined} />;
}
