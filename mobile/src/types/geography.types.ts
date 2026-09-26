// mobile/src/types/geography.types.ts
export interface Country {
  id: string;
  isoCode: string;
  name: string;
  phoneCode: string;
  isActive: boolean;
  isCrossBorderEnabled: boolean;
  defaultCurrencyId: string | null;
}

export interface City {
  id: string;
  countryId: string;
  prefectureId: string | null;
  name: string;
}