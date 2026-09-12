// web-admin/src/services/api/ApiError.ts
export class ApiError extends Error {
  readonly statusCode: number;
  readonly path?: string;

  constructor(message: string, statusCode: number, path?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.path = path;
  }

  get isAuthError(): boolean {
    return this.statusCode === 401;
  }

  get isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}

export class SessionExpiredError extends ApiError {
  constructor() {
    super('Votre session a expiré, reconnectez-vous.', 401);
    this.name = 'SessionExpiredError';
  }
}
