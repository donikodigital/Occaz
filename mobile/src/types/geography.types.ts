// mobile/src/types/geography.types.ts
export interface Country {
  id: string;
  isoCode: string;
  name: string;
  phoneCode: string;
  isActive: boolean;
  isCrossBorderEnabled: boolean;
  /** Pays présélectionné à l'inscription (réglé par l'administration). */
  isSignupDefault?: boolean;
  defaultCurrencyId: string | null;
}

export interface City {
  id: string;
  countryId: string;
  prefectureId: string | null;
  name: string;
  /** Centre de la ville — renseigné par le serveur quand il est connu ; sert de repli à la carte de l'accueil. */
  latitude?: number | null;
  longitude?: number | null;
}
