// mobile/src/hooks/usePhoneChange.ts
//
// Changement de numéro de téléphone : demande du code (SMS au nouveau numéro) puis confirmation. Au succès, le compte en mémoire
// prend le nouveau numéro et les profils sont rechargés — tous les écrans qui affichent le numéro se mettent à jour.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';

export function useRequestPhoneChange() {
  return useMutation({ mutationFn: (newPhone: string) => authApi.requestPhoneChange(newPhone) });
}

export function useConfirmPhoneChange() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  return useMutation({
    // Le code est un paramètre de la mutation, jamais lu depuis l'état du composant (voir verify-otp.tsx : setCode() est asynchrone).
    mutationFn: ({ newPhone, code }: { newPhone: string; code: string }) => authApi.confirmPhoneChange(newPhone, code),
    onSuccess: (user) => {
      updateUser(user);
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
    },
  });
}
