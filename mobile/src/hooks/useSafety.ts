// mobile/src/hooks/useSafety.ts
// [11/10/2026] v1 — SOS, proches à prévenir, signalements, blocages.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blocksApi, emergencyContactsApi, reportsApi, sosApi } from '@/services/api/safety.api';
import type { CreateEmergencyContactPayload, CreateReportPayload, TriggerSosPayload, UserTarget } from '@/types/safety.types';

// --- Proches à prévenir ---

export function useEmergencyContacts() {
  return useQuery({ queryKey: ['emergency-contacts'], queryFn: () => emergencyContactsApi.list() });
}

export function useAddEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmergencyContactPayload) => emergencyContactsApi.add(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] }),
  });
}

export function useRemoveEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emergencyContactsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] }),
  });
}

// --- SOS ---

/** Mes alertes récentes : celle qui est encore active (nouvelle ou prise en charge) s'affiche partout où le bouton SOS apparaît. */
export function useMySosAlerts() {
  return useQuery({ queryKey: ['sos', 'mine'], queryFn: () => sosApi.mine(), refetchInterval: 30_000 });
}

export function useTriggerSos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TriggerSosPayload) => sosApi.trigger(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] }),
  });
}

export function useCancelSos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sosApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] }),
  });
}

// --- Signalements et blocages ---

export function useReportUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReportPayload) => reportsApi.create(payload),
    onSuccess: (result) => {
      if (result.blocked) queryClient.invalidateQueries({ queryKey: ['blocks'] });
    },
  });
}

export function useBlockedUsers() {
  return useQuery({ queryKey: ['blocks'], queryFn: () => blocksApi.list() });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: UserTarget) => blocksApi.block(target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
}
