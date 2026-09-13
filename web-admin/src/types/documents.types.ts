// web-admin/src/types/documents.types.ts
export type DocumentOwnerType = 'DRIVER' | 'VEHICLE' | 'DISPUTE' | 'SHIPMENT';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface AppDocument {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  type: string;
  storageKey: string;
  status: DocumentStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
