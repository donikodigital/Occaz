// mobile/app/(driver)/dispute/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { DisputeDetailScreen } from '@/components/screens/DisputeDetailScreen';

export default function DriverDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DisputeDetailScreen disputeId={id} />;
}
