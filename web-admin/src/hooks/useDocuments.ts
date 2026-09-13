// web-admin/src/hooks/useDocuments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/services/api/documents.api';
import type { DocumentOwnerType } from '@/types/documents.types';

export function useDocumentsForOwner(ownerType: DocumentOwnerType, ownerId: string | undefined) {
  return useQuery({
    queryKey: ['documents', ownerType, ownerId],
    queryFn: () => documentsApi.findForOwner(ownerType, ownerId!),
    enabled: Boolean(ownerId),
  });
}

export function useVerifyDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.verify(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }),
  });
}

export function useRejectDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => documentsApi.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }),
  });
}
