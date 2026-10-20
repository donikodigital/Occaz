// mobile/app/(driver)/terms.tsx
// Conditions générales : texte définitif (src/content/legal.ts), identique à la version en ligne (COMPANY.termsUrl).

import React from 'react';
import { IconFileText } from '@tabler/icons-react-native';
import { LegalDocumentScreen } from '@/components/screens/LegalDocumentScreen';
import { COMPANY, TERMS_OF_USE } from '@/content/legal';

export default function TermsScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} icon={<IconFileText />} webUrl={COMPANY.termsUrl} />;
}
