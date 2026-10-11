// mobile/src/stores/authFlowStore.ts
// [11/10/2026] v1 — Ce que l'on garde en mémoire (jamais sur disque) entre les écrans d'inscription et de mot de passe oublié :
// l'espace choisi, les informations saisies avant la vérification du numéro, et le jeton qui autorise le nouveau mot de passe.
import { create } from 'zustand';
import type { Country } from '@/types/geography.types';

export type SignupAccountType = 'CUSTOMER' | 'DRIVER';

interface AuthFlowState {
  accountType: SignupAccountType;
  lastName: string;
  firstName: string;
  country: Country | null;
  /** Numéro international vérifié (« +224620000010 »). */
  phone: string;
  /** Jeton remis après un code de réinitialisation correct (valable 10 minutes). */
  resetToken: string | null;
  setSignup: (data: { accountType: SignupAccountType; lastName: string; firstName: string; country: Country | null; phone: string }) => void;
  setResetToken: (token: string | null) => void;
  /** Vide tout (fin d'inscription, retour à l'accueil). */
  reset: () => void;
}

const EMPTY = {
  accountType: 'CUSTOMER' as SignupAccountType,
  lastName: '',
  firstName: '',
  country: null as Country | null,
  phone: '',
  resetToken: null as string | null,
};

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  ...EMPTY,
  setSignup: (data) => set({ ...data }),
  setResetToken: (resetToken) => set({ resetToken }),
  reset: () => set({ ...EMPTY }),
}));
