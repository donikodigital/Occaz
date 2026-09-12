// web-admin/src/services/api/types.ts
/**
 * Miroir exact de l'enveloppe de réponse du backend
 * (TransformResponseInterceptor / HttpExceptionFilter) — même contrat
 * que mobile/src/services/api/types.ts, ce projet est un client
 * distinct du même backend.
 */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    path: string;
    timestamp: string;
  };
}

/** Montants BigInt sérialisés en chaîne côté backend — jamais `number`, pour ne jamais perdre de précision. */
export type Money = string;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
