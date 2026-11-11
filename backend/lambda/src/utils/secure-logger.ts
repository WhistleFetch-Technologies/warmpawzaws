/**
 * Batch 4 — Secure structured application logger.
 *
 * Emits JSON to stdout/stderr (CloudWatch). Always sanitizes payloads via
 * safe-hono-error helpers. Prefer this over console.error(error) for new code
 * and remediations.
 */
import {
  redactSecretsForLog,
  sanitizeErrorForLog,
  sanitizeValueForLog,
} from './safe-hono-error';

export type SecureLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SecureLogContext = Record<string, unknown> & {
  requestId?: string;
  correlationId?: string;
  path?: string;
  method?: string;
  eventType?: string;
};

const MAX_LINE_JSON = 8000;
const MAX_FIELD_CHARS = 2000;

function truncateField(value: unknown, max = MAX_FIELD_CHARS): unknown {
  if (typeof value === 'string') {
    const safe = redactSecretsForLog(value);
    return safe.length > max ? `${safe.slice(0, max)}…[truncated]` : safe;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateField(v, max);
    }
    return out;
  }
  return value;
}

function emit(level: SecureLogLevel, payload: Record<string, unknown>): void {
  let line: string;
  try {
    // Hard-cap large fields after sanitization so truncation cannot reintroduce raw input.
    const capped: Record<string, unknown> = {
      ...payload,
      message:
        typeof payload.message === 'string'
          ? truncateField(payload.message)
          : payload.message,
      prefix:
        typeof payload.prefix === 'string' ? truncateField(payload.prefix) : payload.prefix,
      error: payload.error != null ? truncateField(payload.error) : payload.error,
      context: payload.context != null ? truncateField(payload.context) : payload.context,
    };
    line = JSON.stringify(capped);
    if (line.length > MAX_LINE_JSON) {
      line = JSON.stringify({
        level: capped.level,
        message: '[truncated]',
        prefix: capped.prefix,
        requestId: capped.requestId,
        _truncated: true,
        timestamp: capped.timestamp,
        environment: capped.environment,
      });
    }
  } catch {
    line = JSON.stringify({
      level: level.toUpperCase(),
      message: '[log-serialization-failed]',
      timestamp: new Date().toISOString(),
    });
  }

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Structured secure log event (no raw Error objects).
 */
export function secureLog(
  level: SecureLogLevel,
  message: string,
  context?: SecureLogContext,
): void {
  const safeContext = sanitizeValueForLog(context || {}) as Record<string, unknown>;
  emit(level, {
    level: level.toUpperCase(),
    message: redactSecretsForLog(message || ''),
    context: safeContext,
    requestId:
      (typeof safeContext.requestId === 'string' && safeContext.requestId) ||
      (typeof safeContext.correlationId === 'string' && safeContext.correlationId) ||
      undefined,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  });
}

/**
 * Log an exception safely for CloudWatch (sanitized message/stack/cause only).
 */
export function secureLogError(
  prefix: string,
  error: unknown,
  context?: SecureLogContext,
): void {
  const safeError = sanitizeErrorForLog(error);
  const safeContext = sanitizeValueForLog(context || {}) as Record<string, unknown>;
  emit('error', {
    level: 'ERROR',
    prefix: redactSecretsForLog(prefix || 'Error'),
    error: safeError,
    context: safeContext,
    requestId:
      (typeof safeContext.requestId === 'string' && safeContext.requestId) ||
      (typeof safeContext.correlationId === 'string' && safeContext.correlationId) ||
      undefined,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  });
}
