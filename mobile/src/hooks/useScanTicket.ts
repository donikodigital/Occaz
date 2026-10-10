// mobile/src/hooks/useScanTicket.ts
// [11/10/2026] v1 — contrôle d'un billet ou d'une étiquette scanné par le conducteur.
import { useMutation } from '@tanstack/react-query';
import { ticketsApi } from '@/services/api/tickets.api';

export function useScanTicket() {
  return useMutation({ mutationFn: (code: string) => ticketsApi.scan(code) });
}
