// mobile/src/utils/spaces.ts
// [19/10/2026] v1 — Adresses d'accueil des deux espaces et espace d'un compte selon son type.
import type { AccountType } from '@/types/auth.types';
import type { Space } from '@/types/roles.types';

export const HOME_HREF: Record<Space, '/(driver)/(tabs)/home' | '/(customer)/(tabs)/home'> = {
  DRIVER: '/(driver)/(tabs)/home',
  CUSTOMER: '/(customer)/(tabs)/home',
};

/** Espace « naturel » d'un compte : celui du type choisi à l'inscription. */
export function spaceOfAccountType(accountType: AccountType | undefined): Space {
  return accountType === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
}

/** Dossier de routes (expo-router) d'un espace. */
export function groupOfSpace(space: Space): '(driver)' | '(customer)' {
  return space === 'DRIVER' ? '(driver)' : '(customer)';
}
