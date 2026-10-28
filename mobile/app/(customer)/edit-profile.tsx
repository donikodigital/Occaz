// mobile/app/(customer)/edit-profile.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
// [10/10/2026] v7 — champ Email (optionnel) pour renseigner / modifier son adresse, comme côté conducteur.
// L'email vit sur User : sa valeur actuelle vient du store d'authentification, et le store est mis à jour après enregistrement.
//
// [21/09/2026] v6 — photo de profil modifiable (galerie ou appareil photo), comme côté conducteur.
//
// v5 — Habillage bleu océan (en-tête de retour, sections à en-tête
// soulignée, bouton plein). Logique inchangée : date de naissance en saisie
// manuelle JJ/MM/AAAA avec les slashs insérés pendant la frappe (pas de
// CalendarPicker : son usage ailleurs dans l'app suggère des dates
// futures uniquement — trip-new.tsx — pas adapté à une date de naissance).

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconDeviceMobile, IconLock, IconMapPin, IconUserCircle } from '@tabler/icons-react-native';
import { AppText, ProfilePhotoField, ScreenContainer, TextField } from '@/components/ui';
import { CountrySelectField } from '@/components/screens/CountrySelectField';
import { LockedField } from '@/components/screens/LockedField';
import { OceanButton, OceanCard, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCustomerPhotoUpload } from '@/hooks/useCustomerPhotoUpload';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country } from '@/types/geography.types';
import { useT } from '@/i18n';

const CITY_FIELD = 'customer-edit-profile-city';

/** "19980412" -> "12/04/1998" — insère les slashs au fil de la frappe. */
function formatDateOfBirthInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  let result = day;
  if (month) result += `/${month}`;
  if (year) result += `/${year}`;
  return result;
}

/** "12/04/1998" -> "1998-04-12" (ISO, attendu par le backend) ou undefined si incomplet/invalide. */
function dateOfBirthToIso(display: string): string | undefined {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  // Rejette les dates que Date() accepterait en "roulant" (ex: 31/02 -> 03/03).
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  if (date > new Date()) return undefined;
  return iso;
}

/** "1998-04-12T00:00:00.000Z" ou "1998-04-12" -> "12/04/1998" pour préremplir le champ. */
function isoToDateOfBirthDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

export default function EditProfileScreen() {
  const t = useT();
  const { data: profile } = useCustomerProfile();
  const authUser = useAuthStore((state) => state.user);
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const accountPhone = authUser?.phone ?? '';
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [email, setEmail] = useState(authUser?.email ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(isoToDateOfBirthDisplay(profile?.dateOfBirth));
  const [country, setCountry] = useState<Country | null>(profile?.country ?? null);
  const [city, setCity] = useState<City | null>(profile?.city ?? null);
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const updateProfile = useUpdateCustomerProfile();
  const photoUpload = useCustomerPhotoUpload((updated) => setPhotoUrl(updated.photoUrl));

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (citySelection?.field === CITY_FIELD) {
      setCity(citySelection.city);
      consumeCitySelection();
    }
  }, [citySelection, consumeCitySelection]);

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage(t('Renseignez votre prénom et votre nom.'));
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(t('Adresse email invalide.'));
      return;
    }

    let dateOfBirthIso: string | undefined;
    if (dateOfBirth.trim().length > 0) {
      dateOfBirthIso = dateOfBirthToIso(dateOfBirth.trim());
      if (!dateOfBirthIso) {
        setErrorMessage(t('Date de naissance invalide (format JJ/MM/AAAA).'));
        return;
      }
    }

    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail || undefined,
        countryId: country?.id,
        cityId: city?.id,
        address: address.trim() || undefined,
        ...(dateOfBirthIso ? { dateOfBirth: dateOfBirthIso } : {}),
      },
      {
        onSuccess: () => {
          // Le profil client invalidé par le hook ne contient pas l'email (il vit sur User) : sans cette mise à jour,
          // l'écran afficherait l'ancienne adresse jusqu'à la prochaine connexion.
          if (trimmedEmail && authUser) {
            updateAuthUser({ ...authUser, email: trimmedEmail });
          }
          router.back();
        },
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Modifier le profil')} subtitle={t('Compte client')} icon={<IconUserCircle />} onBack={() => router.back()} />

      <ProfilePhotoField
        photoUrl={photoUrl}
        initials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
        isUploading={photoUpload.isUploading}
        onPickLibrary={photoUpload.pickFromLibrary}
        onPickCamera={photoUpload.pickFromCamera}
        errorMessage={photoUpload.error}
      />
      <View style={{ height: spacing.lg }} />

      <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title={t('Identité')}>
        <TextField label={t('Prénom')} value={firstName} onChangeText={setFirstName} placeholder={t('Fatoumata')} />
        <TextField label={t('Nom')} value={lastName} onChangeText={setLastName} placeholder={t('Diallo')} />
        <TextField
          label={t('Email (optionnel)')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('vous@exemple.com')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label={t('Date de naissance (optionnel)')}
          value={dateOfBirth}
          onChangeText={(text) => setDateOfBirth(formatDateOfBirthInput(text))}
          placeholder={t('JJ/MM/AAAA')}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* Le numéro est l'identifiant de connexion : il ne se change que par le parcours avec code SMS. */}
        <LockedField label={t('Téléphone')} value={accountPhone} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(customer)/change-phone')}
          style={({ pressed }) => [styles.changePhone, pressed && styles.pressed]}
        >
          <IconDeviceMobile size={15} color={OCEAN.base} />
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {t('Changer mon numéro')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(customer)/change-password')}
          style={({ pressed }) => [styles.changePhone, pressed && styles.pressed]}
        >
          <IconLock size={15} color={OCEAN.base} />
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {t('Changer mon mot de passe')}
          </AppText>
        </Pressable>
      </OceanSection>

      <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title={t('Localisation')}>
        <CountrySelectField label={t('Pays')} value={country} onSelect={setCountry} />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.cityLabel}>
            {t('Ville')}
          </AppText>
          <OceanCard
            onPress={() => {
              openCityPicker(CITY_FIELD);
              router.push('/(customer)/select-city');
            }}
            style={styles.cityCard}
            accessibilityLabel={t('Choisir une ville')}
          >
            <View style={styles.cityIcon}>
              <IconMapPin size={16} color={OCEAN.base} />
            </View>
            <AppText variant="base" weight={city ? 'semibold' : 'medium'} color={city ? 'textPrimary' : 'textSecondary'} style={styles.cityText}>
              {city?.name ?? t('Choisir une ville')}
            </AppText>
            <IconChevronRight size={16} color={colors.textMuted} />
          </OceanCard>
        </View>

        <TextField
          label={t('Adresse (optionnel)')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('Ex : quartier, repère connu')}
          multiline
          style={styles.addressField}
        />
      </OceanSection>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton label={t('Enregistrer')} onPress={handleSubmit} loading={updateProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  changePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  cityLabel: {
    marginBottom: spacing.xxs,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  cityIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityText: {
    flex: 1,
  },
  addressField: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});
