// web-admin/src/services/api/staffAccounts.api.ts
import { api } from './client';
import type {
  CreateStaffAccountPayload,
  CreateStaffAccountResult,
  StaffAccount,
  StaffInvitationPreview,
} from '@/types/staff-accounts.types';

export const staffAccountsApi = {
  list: () => api.get<StaffAccount[]>('/staff-accounts'),

  create: (payload: CreateStaffAccountPayload) => api.post<CreateStaffAccountResult>('/staff-accounts', payload),

  resendInvitation: (id: string) => api.post<{ invitationSent: true }>(`/staff-accounts/${id}/resend-invitation`),

  /** Routes publiques du lien reçu par e-mail : le jeton du lien est le seul justificatif. */
  inspectInvitation: (token: string) =>
    api.post<StaffInvitationPreview>('/staff-invitations/inspect', { token }, { auth: false }),

  acceptInvitation: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/staff-invitations/accept', { token, newPassword }, { auth: false }),
};
