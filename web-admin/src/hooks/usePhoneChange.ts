// web-admin/src/hooks/usePhoneChange.ts
// [19/10/2026] v1 — Changement de numéro du compte connecté (équipe : le code arrive par e-mail). Après la confirmation, le compte est
// rechargé pour que le menu et la page affichent aussitôt le nouveau numéro.
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';

export function useRequestPhoneChange() {
  return useMutation({ mutationFn: (newPhone: string) => authApi.requestPhoneChange(newPhone) });
}

export function useConfirmPhoneChange() {
  const hydrate = useAuthStore((state) => state.hydrate);
  return useMutation({
    mutationFn: ({ newPhone, code }: { newPhone: string; code: string }) => authApi.confirmPhoneChange(newPhone, code),
    onSuccess: () => hydrate(),
  });
}
