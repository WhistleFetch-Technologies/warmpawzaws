import { ApiError } from './error-handling';

const CONNECTION_HINT = 'Check your internet connection and try again.';

/**
 * Maps fetch / ApiError failures to short user-facing copy.
 * Avoid blaming "connection" for 401/5xx/config issues.
 *
 * @param leadSentence — First clause without trailing period, e.g. "Could not load labs"
 */
export function formatCustomerApiFailure(err: unknown, leadSentence: string): string {
  const head = leadSentence.trim().replace(/\s*\.\s*$/, '');

  if (err instanceof ApiError) {
    if (err.code === 'offline' || err.message?.includes('No network connection')) {
      return `${head}. ${CONNECTION_HINT}`;
    }
    if (err.statusCode === 401) {
      return `${head}. Please sign in again.`;
    }
    if (err.statusCode === 403) {
      return `${head}. You may need to sign in again, or contact support if this continues.`;
    }
    if (err.statusCode === 404) {
      const detail = err.message?.trim();
      if (detail && !/^HTTP\s*404\b/i.test(detail) && detail.length < 240) {
        return `${head}. ${detail}`;
      }
      return `${head}. This booking or chat was not found.`;
    }
    if (err.statusCode === 408 || err.statusCode === 504) {
      return `${head}. The request timed out. ${CONNECTION_HINT}`;
    }
    if (err.statusCode === 429) {
      return `${head}. Too many requests—wait a moment and try again.`;
    }
    if (err.statusCode != null && err.statusCode >= 500) {
      return `${head}. Our servers had a problem—please try again in a few minutes.`;
    }
    const m = err.message?.trim();
    if (m) return `${head}. ${m}`;
    return `${head}. Please try again.`;
  }

  const msg = typeof (err as Error)?.message === 'string' ? (err as Error).message.trim() : '';
  if (msg.includes('API_BASE_URL is not configured')) {
    return `${head}. The app is missing server configuration—contact support.`;
  }
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    /ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(msg)
  ) {
    return `${head}. ${CONNECTION_HINT}`;
  }
  if (msg) return `${head}. ${msg}`;
  return `${head}. Please try again.`;
}
