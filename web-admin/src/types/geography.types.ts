// web-admin/src/types/geography.types.ts
export interface Country {
  id: string;
  isoCode: string;
  name: string;
  phoneCode: string;
  defaultCurrencyId: string | null;
  isCrossBorderEnabled: boolean;
  isActive: boolean;
}

export interface Currency {
  id: string;
  isoCode: string;
  name: string;
  symbol: string | null;
  decimalDigits: number;
}

export interface Region {
  id: string;
  countryId: string;
  name: string;
}

export interface Prefecture {
  id: string;
  regionId: string;
  name: string;
}

export interface City {
  id: string;
  countryId: string;
  prefectureId: string | null;
  name: string;
}

export interface CreateCountryPayload {
  isoCode: string;
  name: string;
  phoneCode: string;
  defaultCurrencyId?: string;
  isCrossBorderEnabled?: boolean;
}

export interface CreateCurrencyPayload {
  isoCode: string;
  name: string;
  symbol?: string;
  decimalDigits?: number;
}

export interface CreateRegionPayload {
  countryId: string;
  name: string;
}

export interface CreatePrefecturePayload {
  regionId: string;
  name: string;
}

export interface CreateCityPayload {
  countryId: string;
  prefectureId?: string;
  name: string;
}
