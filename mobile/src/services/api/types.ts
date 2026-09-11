// mobile/src/services/api/types.ts
/**
 * Miroir exact de l'enveloppe de réponse du backend
 * (TransformResponseInterceptor / HttpExceptionFilter, Lot 1). Tout
 * changement de forme côté backend doit se répercuter ici en premier.
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

/**
 * Les montants (BigInt côté backend) sont sérialisés en chaîne — jamais
 * en `number`, pour ne jamais perdre de précision sur un gros solde.
 * Voir common/utils/bigint-json.util.ts côté backend.
 */
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
