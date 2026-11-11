/**
 * ============================================================================
 * ERROR SERIALIZATION UTILITY (Batch 2 — F08)
 * ============================================================================
 *
 * Separates:
 * - Client-facing safe messages (never raw exception / SQL / secrets)
 * - Internal diagnostic extraction (server-side branching / logging only)
 *
 * Date: 2026-01-12
 * Remediation: 2026-11-11 SOC 2 Batch 2
 * ============================================================================
 */

import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  getHttpExceptionStatus,
  publicMessageForHttpStatus,
  redactSecretsForLog,
  sanitizeErrorForLog,
} from './safe-hono-error';

/** Valid HTTP status codes for error responses */
export type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

const ERROR_STATUS_SET = new Set<number>([400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504]);

function asErrorStatusCode(status: number, fallback: ErrorStatusCode): ErrorStatusCode {
  return ERROR_STATUS_SET.has(status) ? (status as ErrorStatusCode) : fallback;
}

const INTERNAL_MESSAGE_MAX = 2000;

/**
 * INTERNAL ONLY — extract a diagnostic string for server-side branching / logs.
 * NEVER pass the return value to API clients.
 *
 * Prefer `sanitizeErrorForLog` / `redactSecretsForLog` when writing logs.
 */
export function getInternalErrorMessage(error: unknown): string {
  let raw = '';
  if (error instanceof Error) {
    raw = error.message || error.name || 'Unknown error';
  } else if (typeof error === 'string') {
    raw = error;
  } else if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      raw = errorObj.message;
    } else if (typeof errorObj.error === 'string') {
      raw = errorObj.error;
    } else if (typeof errorObj.code === 'string' || typeof errorObj.code === 'number') {
      raw = `Error code: ${String(errorObj.code)}`;
    } else {
      // Do not JSON.stringify arbitrary objects (may contain secrets).
      raw = 'Unknown error object';
    }
  } else if (error == null) {
    raw = 'Unknown error';
  } else {
    raw = String(error);
  }

  const redacted = redactSecretsForLog(raw);
  if (redacted.length > INTERNAL_MESSAGE_MAX) {
    return `${redacted.substring(0, INTERNAL_MESSAGE_MAX)}...`;
  }
  return redacted || 'Unknown error';
}

/**
 * Client-safe error message. Never returns raw exception / SQL / infra text.
 *
 * @param error - Thrown value (used only to detect HTTPException status)
 * @param fallback - Explicitly approved public message (defaults to generic 500 text)
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = SAFE_INTERNAL_ERROR_MESSAGE,
): string {
  const httpStatus = getHttpExceptionStatus(error);
  if (httpStatus !== null && httpStatus < 500) {
    const approved =
      fallback &&
      fallback !== SAFE_INTERNAL_ERROR_MESSAGE &&
      fallback !== 'Internal server error' &&
      fallback.trim() !== '';
    return approved ? fallback.trim() : publicMessageForHttpStatus(httpStatus);
  }

  const trimmed = typeof fallback === 'string' ? fallback.trim() : '';
  if (trimmed && trimmed !== 'Internal server error') {
    // Caller-supplied public label for unexpected failures (no exception text).
    return trimmed;
  }
  return SAFE_INTERNAL_ERROR_MESSAGE;
}

/**
 * Create a safe error response object for API clients.
 * Never embeds raw exception messages or object serialization.
 *
 * - status >= 500 → `defaultMessage` (if provided) or SAFE_INTERNAL_ERROR_MESSAGE
 * - status < 500 → `defaultMessage` when explicitly approved, else publicMessageForHttpStatus
 * - HTTPException status overrides the default statusCode when valid
 */
export function createSafeErrorResponse(
  error: unknown,
  defaultMessage: string = SAFE_INTERNAL_ERROR_MESSAGE,
  statusCode: ErrorStatusCode = 500,
): { success: false; error: string; statusCode: ErrorStatusCode } {
  const httpStatus = getHttpExceptionStatus(error);
  const status =
    httpStatus !== null
      ? asErrorStatusCode(httpStatus, statusCode)
      : asErrorStatusCode(statusCode, 500);

  const explicit =
    typeof defaultMessage === 'string' &&
    defaultMessage.trim() !== '' &&
    defaultMessage.trim() !== 'Internal server error';

  let message: string;
  if (status >= 500) {
    message = explicit ? defaultMessage.trim() : SAFE_INTERNAL_ERROR_MESSAGE;
  } else if (explicit && defaultMessage.trim() !== SAFE_INTERNAL_ERROR_MESSAGE) {
    message = defaultMessage.trim();
  } else {
    message = publicMessageForHttpStatus(status);
  }

  return {
    success: false,
    error: message,
    statusCode: status,
  };
}

/**
 * Safely serialize error for logging (secrets redacted).
 * Not for client responses.
 */
export function serializeErrorForLogging(error: unknown): string {
  try {
    const sanitized = sanitizeErrorForLog(error);
    return JSON.stringify(sanitized);
  } catch {
    return '{"message":"[redaction-failed]"}';
  }
}
