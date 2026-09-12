// mobile/app/(driver)/conversation/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { ConversationThreadScreen } from '@/components/screens/ConversationThreadScreen';

export default function DriverConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationThreadScreen conversationId={id} />;
}
