// mobile/src/components/screens/LegalDocumentScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [28/10/2026] Le texte français (legal.ts) sert de clé de traduction ; en anglais / portugais, un paragraphe sans traduction reste en français.
// Affiche un texte juridique (politique de confidentialité, conditions générales) à partir de src/content/legal.ts.
// Un même écran sert aux espaces client et conducteur ; le texte lui-même est identique à celui du site (occaz.sarl).

import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconInfoCircle } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { COMPANY, LEGAL_UPDATED_AT, type LegalBlock, type LegalDocument } from '@/content/legal';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT, translate } from '@/i18n';

interface Props {
  document: LegalDocument;
  icon: React.ReactElement<{ color?: string; size?: number }>;
  /** Lien vers la version en ligne du même texte. */
  webUrl: string;
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'ul') {
    return (
      <View style={styles.list}>
        {block.items.map((item) => (
          <View key={item} style={styles.listItem}>
            <AppText variant="sm" color="textSecondary" style={styles.bullet}>
              •
            </AppText>
            <AppText variant="sm" color="textSecondary" style={[styles.paragraph, styles.flex]}>
              {translate(item)}
            </AppText>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === 'note') {
    return (
      <View style={styles.note}>
        <IconInfoCircle size={18} color={OCEAN.deep} />
        <AppText variant="sm" color={OCEAN.deep} weight="medium" style={[styles.paragraph, styles.flex]}>
          {translate(block.text)}
        </AppText>
      </View>
    );
  }
  return (
    <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
      {translate(block.text)}
    </AppText>
  );
}

export function LegalDocumentScreen({ document, icon, webUrl }: Props) {
  const t = useT();
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t(document.title)} icon={icon} onBack={() => router.back()} />

      <AppText variant="xs" color="textMuted" style={styles.updated}>
        {t('Dernière mise à jour : {LEGAL_UPDATED_AT}', { LEGAL_UPDATED_AT: t(LEGAL_UPDATED_AT) })}
      </AppText>
      <AppText variant="sm" color="textSecondary" style={[styles.paragraph, styles.intro]}>
        {t(document.intro)}
      </AppText>

      {document.sections.map((section) => (
        <View key={section.title} style={styles.article}>
          <AppText variant="sm" weight="bold" color={OCEAN.deep}>
            {t(section.title)}
          </AppText>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </View>
      ))}

      <AppText variant="xs" color="textMuted" style={styles.footer}>
        {t('Ce texte est aussi disponible en ligne :')}{' '}
        <AppText variant="xs" color={OCEAN.deep} weight="medium" onPress={() => Linking.openURL(webUrl)}>
          {webUrl.replace('https://', '')}
        </AppText>
        {t('\nQuestions : {supportEmail}', { supportEmail: COMPANY.supportEmail })}
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  updated: { marginBottom: spacing.sm },
  intro: { marginBottom: spacing.lg },
  article: { gap: spacing.xs, marginBottom: spacing.md },
  paragraph: { lineHeight: 20 },
  list: { gap: 4 },
  listItem: { flexDirection: 'row', gap: spacing.xs },
  bullet: { width: 12, lineHeight: 20 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.sm + 2,
  },
  footer: { marginTop: spacing.md, marginBottom: spacing.lg, lineHeight: 18 },
});
