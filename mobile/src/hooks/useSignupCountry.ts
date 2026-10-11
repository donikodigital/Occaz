// mobile/src/hooks/useSignupCountry.ts
// [11/10/2026] v1 — Le pays proposé en premier à l'inscription et à la connexion : celui que l'administration a marqué « par défaut »
// (Géographie → Pays), sinon la Guinée (+224), sinon le premier de la liste. La personne peut en choisir un autre.
import { useEffect } from 'react';
import { useCountries } from '@/hooks/useCities';
import { formatDialCode } from '@/utils/phone';
import type { Country } from '@/types/geography.types';

export function pickDefaultCountry(countries: Country[] | undefined): Country | null {
  if (!countries || countries.length === 0) return null;
  return (
    countries.find((country) => country.isSignupDefault) ??
    countries.find((country) => formatDialCode(country.phoneCode) === '+224') ??
    countries[0] ??
    null
  );
}

/** Présélectionne le pays par défaut dès que la liste est chargée, sans écraser un choix déjà fait. */
export function useDefaultSignupCountry(current: Country | null, onDefault: (country: Country) => void) {
  const query = useCountries();
  const fallback = pickDefaultCountry(query.data);
  useEffect(() => {
    if (!current && fallback) onDefault(fallback);
    // onDefault est un setState : le stabiliser n'apporte rien et provoquerait une boucle si on le passait en dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, fallback?.id]);
  return query;
}
