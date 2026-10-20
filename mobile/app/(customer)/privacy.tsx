// mobile/app/(customer)/privacy.tsx
// Politique de confidentialité : texte définitif (src/content/legal.ts), identique à la version en ligne (COMPANY.privacyUrl).

import React from 'react';
import { IconShieldCheck } from '@tabler/icons-react-native';
import { LegalDocumentScreen } from '@/components/screens/LegalDocumentScreen';
import { COMPANY, PRIVACY_POLICY } from '@/content/legal';

export default function PrivacyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} icon={<IconShieldCheck />} webUrl={COMPANY.privacyUrl} />;
}
