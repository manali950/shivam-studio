/** One error type for both providers so pages can render server and mock failures identically. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');