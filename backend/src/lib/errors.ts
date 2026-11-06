/** One error type for the whole API. The error middleware renders it as { error: { code, message, details } }. */
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}
export const unauthenticated = (msg = 'Please sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', msg);
export const forbidden = (msg = 'You are not allowed to perform this action.', code = 'FORBIDDEN') => new AppError(403, code, msg);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (msg: string, details?: unknown) => new AppError(409, 'CONFLICT', msg, details);
export const invalid = (msg: string, details?: unknown) => new AppError(422, 'VALIDATION_ERROR', msg, details);
export const badRequest = (msg: string, code = 'BAD_REQUEST') => new AppError(400, code, msg);