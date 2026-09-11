// mobile/src/types/currencies.types.ts
export interface Currency {
  id: string;
  isoCode: string;
  name: string;
  symbol: string | null;
  decimalDigits: number;
}
