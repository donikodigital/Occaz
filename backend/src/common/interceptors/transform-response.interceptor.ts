// backend/src/common/interceptors/transform-response.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Enveloppe toute réponse réussie dans une forme unique { success, data }.
 * Les listes paginées (PaginatedResult) conservent leur structure
 * { data, meta } telle quelle à l'intérieur de `data`.
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
