// web-admin/src/hooks/useSafety.ts
// [11/10/2026] v1 — signalements d'utilisateurs et alertes SOS. Les alertes SOS se rafraîchissent toutes seules (15 s) : une urgence ne doit pas attendre un clic.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { safetyApi } from '@/services/api/safety.api';
import type { HandleSosPayload, RemindReportPayload, SosStatus, UpdateUserReportPayload, UserReportStatus } from '@/types/safety.types';

export function useReportsList(params: { page?: number; status?: UserReportStatus }) {
  return useQuery({
    queryKey: ['user-reports', params],
    queryFn: () => safetyApi.listReports({ ...params, limit: 20 }),
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserReportPayload }) => safetyApi.updateReport(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-reports'] }),
  });
}

export function useRemindReport() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RemindReportPayload }) => safetyApi.remindReport(id, payload),
  });
}

export function useSosList(params: { page?: number; status?: SosStatus }) {
  return useQuery({
    queryKey: ['sos-alerts', params],
    queryFn: () => safetyApi.listSos({ ...params, limit: 20 }),
    refetchInterval: 15_000,
  });
}

export function useHandleSos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: HandleSosPayload }) => safetyApi.handleSos(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sos-alerts'] }),
  });
}
