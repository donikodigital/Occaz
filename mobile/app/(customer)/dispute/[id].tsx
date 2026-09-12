// mobile/app/(customer)/dispute/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { DisputeDetailScreen } from '@/components/screens/DisputeDetailScreen';

export default function CustomerDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DisputeDetailScreen disputeId={id} />;
}
