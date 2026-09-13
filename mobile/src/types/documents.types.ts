// mobile/src/types/documents.types.ts
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface AppDocument {
  id: string;
  ownerType: 'DRIVER' | 'VEHICLE' | 'DISPUTE' | 'SHIPMENT';
  ownerId: string;
  type: string;
  storageKey: string;
  status: DocumentStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export type UploadableContentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export interface RequestUploadUrlPayload {
  type: string;
  contentType: UploadableContentType;
}

export interface UploadUrlResult {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface CreateDocumentPayload {
  type: string;
  storageKey: string;
  expiresAt?: string;
}
