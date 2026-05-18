import { ApiError } from './error-handling';

/** Read HTTP status from ApiError or legacy error shapes. */
export function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError && error.statusCode != null) {
    return error.statusCode;
  }
  const e = error as { statusCode?: number; status?: number; response?: { status?: number } } | null;
  const code = e?.statusCode ?? e?.status ?? e?.response?.status;
  return typeof code === 'number' ? code : undefined;
}

/** Pet bookings route missing or not implemented — treat as no history. */
export function isPetBookingsUnavailable(error: unknown): boolean {
  const status = getHttpStatus(error);
  return status === 404 || status === 501;
}

/** Pet resource missing — show "Pet not found". */
export function isPetNotFound(error: unknown): boolean {
  return getHttpStatus(error) === 404;
}
