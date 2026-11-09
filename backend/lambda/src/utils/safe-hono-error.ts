/**
 * Stage 1 — centralized Hono error sanitization helpers.
 * Client responses must never include raw exception / SQL / infra details.
 */

export const SAFE_INTERNAL_ERROR_MESSAGE = 'Internal Server Error';

export type SafeErrorClientResult = {
  status: number;
  body: Record<string, unknown>;
};

/** Status → stable public message (no exception text). */
export function publicMessageForHttpStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 405:
      return 'Method Not Allowed';
    case 409:
      return 'Conflict';
    case 413:
      return 'Payload Too Large';
    case 415:
      return 'Unsupported Media Type';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 503:
      return 'Service Unavailable';
    case 504:
      return 'Gateway Timeout';
    default:
      if (status >= 400 && status < 500) return 'Request Error';
      return SAFE_INTERNAL_ERROR_MESSAGE;
  }
}

/**
 * Detect Hono HTTPException-like errors (status + getResponse) without requiring
 * callers to import the class when the thrown value is already an instance.
 */
export function getHttpExceptionStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { status?: unknown; getResponse?: unknown };
  if (typeof anyErr.getResponse !== 'function') return null;
  if (typeof anyErr.status !== 'number') return null;
  if (anyErr.status < 400 || anyErr.status > 599) return null;
  return anyErr.status;
}

const SENSITIVE_FIELD_KEY =
  '(?:password|passwd|secret|client[_-]?secret|api[_-]?key|apiKey|access[_-]?key|access[_-]?token|accessToken|refresh[_-]?token|refreshToken|id[_-]?token|idToken|aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key|aws[_-]?session[_-]?token|session[_-]?token|private[_-]?key|authorization|otp)';

const SENSITIVE_OBJECT_KEY_RE =
  /password|passwd|secret|token|authorization|otp|apikey|api[_-]?key|private|credential|passwd/i;

/**
 * Redact secrets/tokens/PII from strings before internal logging.
 * Intentionally avoids scrubbing bare HTTP statuses, SQLSTATE codes, and request IDs.
 */
export function redactSecretsForLog(text: string): string {
  if (text == null || text === '') return text;
  let s = String(text);

  // Database URLs: keep scheme + user + host, scrub password
  s = s.replace(
    /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/)([^:@/\s]+):([^@/\s]+)@/gi,
    '$1$2:[REDACTED]@',
  );

  // Bearer tokens (header or inline)
  s = s.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');

  // JWT / JWT-like (allow short/truncated segments used in tests and truncated logs)
  s = s.replace(/eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/g, '[REDACTED_JWT]');

  // JSON / JS object style: "password":"value" or 'password':'value'
  s = s.replace(
    new RegExp(`(["'])(${SENSITIVE_FIELD_KEY})\\1\\s*:\\s*(["'])(?:\\\\.|(?!\\3).)*\\3`, 'gi'),
    (_m, q1: string, key: string, _q2: string) => `${q1}${key}${q1}:${q1}[REDACTED]${q1}`,
  );

  // Unquoted / header style: password=value, refreshToken: value, otp:12345
  // Values may be 4+ chars (covers 5-digit OTPs); stop at whitespace/quotes/braces.
  s = s.replace(
    new RegExp(`\\b(${SENSITIVE_FIELD_KEY})\\b\\s*[:=]\\s*["']?[^\\s"',;&}{]+`, 'gi'),
    (_m, key: string) => `${key}=[REDACTED]`,
  );

  // Bare AWS access key IDs (after field scrub so AKIA… inside aws_access_key_id= is already gone)
  s = s.replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED_AWS_KEY]');

  // Contextual phone / mobile (do not scrub bare status codes or SQLSTATE digits)
  s = s.replace(
    /\b(?:phone|mobile|msisdn)(["']?\s*[:=]\s*["']?)\+?\d{8,15}\b/gi,
    (_m, sep: string) => `phone${sep}[REDACTED_PHONE]`,
  );
  s = s.replace(/\bphone=\+?\d{8,15}\b/gi, 'phone=[REDACTED_PHONE]');

  // Email addresses
  s = s.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED_EMAIL]',
  );

  return s;
}

/** Sanitize Error fields for logs without mutating the original Error. */
export function sanitizeErrorForLog(error: unknown): {
  name?: string;
  message: string;
  stack?: string;
  cause?: unknown;
} {
  try {
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      return {
        name: error.name,
        message: redactSecretsForLog(error.message || ''),
        stack: error.stack ? redactSecretsForLog(error.stack) : undefined,
        cause: cause !== undefined ? sanitizeValueForLog(cause) : undefined,
      };
    }
    if (typeof error === 'string') {
      return { message: redactSecretsForLog(error) };
    }
    return { message: redactSecretsForLog(String(error)) };
  } catch {
    return { message: '[redaction-failed]' };
  }
}

/**
 * Deep-sanitize unknown values for logging / Sentry extras.
 * Sensitive object keys are replaced entirely; strings are run through redactSecretsForLog.
 */
export function sanitizeValueForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[MaxDepth]';
  try {
    if (value == null) return value;
    if (typeof value === 'string') return redactSecretsForLog(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Error) return sanitizeErrorForLog(value);
    if (Array.isArray(value)) {
      return value.map((v) => sanitizeValueForLog(v, depth + 1));
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      const seen = value as Record<string, unknown>;
      for (const key of Object.keys(seen)) {
        if (SENSITIVE_OBJECT_KEY_RE.test(key)) {
          out[key] = '[REDACTED]';
          continue;
        }
        try {
          out[key] = sanitizeValueForLog(seen[key], depth + 1);
        } catch {
          out[key] = '[Unserializable]';
        }
      }
      return out;
    }
    return redactSecretsForLog(String(value));
  } catch {
    return '[redaction-failed]';
  }
}

/**
 * Sanitize a Sentry event payload (@sentry/serverless v7 shape) before send.
 * Does not mutate the original thrown Error — only the serialized event.
 */
export function sanitizeSentryEvent(event: any): any {
  try {
    if (!event || typeof event !== 'object') {
      return { message: 'sanitized', level: 'error' };
    }

    if (typeof event.message === 'string') {
      event.message = redactSecretsForLog(event.message);
    }

    if (event.request && typeof event.request === 'object') {
      delete event.request.cookies;
      if (event.request.headers && typeof event.request.headers === 'object') {
        for (const h of Object.keys(event.request.headers)) {
          if (/authorization|cookie|x-uat|api-?key|token|secret|password/i.test(h)) {
            event.request.headers[h] = '[REDACTED]';
          } else {
            event.request.headers[h] = redactSecretsForLog(String(event.request.headers[h]));
          }
        }
      }
      if (event.request.query_string != null) {
        event.request.query_string =
          typeof event.request.query_string === 'string'
            ? redactSecretsForLog(event.request.query_string)
            : sanitizeValueForLog(event.request.query_string);
      }
      if (event.request.data != null) {
        event.request.data = sanitizeValueForLog(event.request.data);
      }
      if (typeof event.request.url === 'string') {
        event.request.url = redactSecretsForLog(event.request.url);
      }
    }

    if (event.user) {
      event.user = sanitizeValueForLog(event.user);
    }
    if (event.extra) {
      event.extra = sanitizeValueForLog(event.extra);
    }
    if (event.contexts) {
      event.contexts = sanitizeValueForLog(event.contexts);
    }
    if (event.tags && typeof event.tags === 'object') {
      event.tags = sanitizeValueForLog(event.tags);
    }

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.map((b: any) => {
        if (!b || typeof b !== 'object') return b;
        return {
          ...b,
          message: typeof b.message === 'string' ? redactSecretsForLog(b.message) : b.message,
          data: b.data != null ? sanitizeValueForLog(b.data) : b.data,
        };
      });
    }

    const values = event.exception?.values;
    if (Array.isArray(values)) {
      for (const ex of values) {
        if (!ex || typeof ex !== 'object') continue;
        if (typeof ex.value === 'string') {
          ex.value = redactSecretsForLog(ex.value);
        }
        const frames = ex.stacktrace?.frames;
        if (Array.isArray(frames)) {
          for (const frame of frames) {
            if (!frame || typeof frame !== 'object') continue;
            if (frame.vars) frame.vars = sanitizeValueForLog(frame.vars);
            if (typeof frame.filename === 'string') {
              frame.filename = redactSecretsForLog(frame.filename);
            }
            if (typeof frame.abs_path === 'string') {
              frame.abs_path = redactSecretsForLog(frame.abs_path);
            }
            if (typeof frame.context_line === 'string') {
              frame.context_line = redactSecretsForLog(frame.context_line);
            }
            if (Array.isArray(frame.pre_context)) {
              frame.pre_context = frame.pre_context.map((l: string) =>
                typeof l === 'string' ? redactSecretsForLog(l) : l,
              );
            }
            if (Array.isArray(frame.post_context)) {
              frame.post_context = frame.post_context.map((l: string) =>
                typeof l === 'string' ? redactSecretsForLog(l) : l,
              );
            }
          }
        }
      }
    }

    return event;
  } catch {
    return { message: 'Error event sanitized (redaction failure)', level: 'error' };
  }
}

/**
 * True when a client JSON body appears to leak internals (for tests / assertions).
 */
export function clientErrorBodyLooksUnsafe(body: unknown): boolean {
  const s = JSON.stringify(body ?? {}).toLowerCase();
  if (!s || s === '{}') return false;
  if (s.includes('"stack"')) return true;
  if (s.includes('sqlstate')) return true;
  if (s.includes('select ') || s.includes('insert ') || s.includes('update ') || s.includes('delete from')) {
    return true;
  }
  if (s.includes('relation "') || s.includes('column "') || s.includes('does not exist')) return true;
  if (s.includes('db_host') || s.includes('vpc') || s.includes('security group')) return true;
  if (s.includes('node_modules') || s.includes('at object.')) return true;
  if (s.includes('eyj') && s.includes('.')) return true; // jwt-ish
  return false;
}

export type MapHonoErrorOptions = {
  method?: string;
  /** For /search degraded envelope only */
  searchQuery?: string;
};

/**
 * Map a thrown error + request path to a sanitized client status/body.
 * Path-specific degraded fallbacks preserve empty/default envelopes but never
 * embed raw exception text.
 */
export function mapHonoThrownErrorToClientResponse(
  err: unknown,
  requestPath: string,
  options: MapHonoErrorOptions = {},
): SafeErrorClientResult {
  const path = requestPath || '';
  const method = (options.method || 'GET').toUpperCase();

  const httpStatus = getHttpExceptionStatus(err);
  if (httpStatus !== null) {
    if (httpStatus >= 500) {
      return { status: 500, body: { error: SAFE_INTERNAL_ERROR_MESSAGE } };
    }
    return {
      status: httpStatus,
      body: { error: publicMessageForHttpStatus(httpStatus) },
    };
  }

  // ── Path-specific degraded responses (sanitize; do not expand fallbacks) ──

  if (
    path.includes('service-catalog/categories') ||
    path.includes('/categories') ||
    path.endsWith('categories')
  ) {
    return {
      status: 200,
      body: {
        success: true,
        categories: [],
        total: 0,
        message: 'Service categories temporarily unavailable',
      },
    };
  }

  if (path.includes('payment-gateways') || path.includes('payment-gateway')) {
    return {
      status: 200,
      body: {
        success: true,
        gateways: [],
        message: 'Payment gateways temporarily unavailable',
      },
    };
  }

  // Message-based routing (server-side only) for legacy SQL drift — response stays generic
  const internalMessage =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (
    internalMessage.includes('operator does not exist') ||
    internalMessage.includes('uuid = text') ||
    internalMessage.includes('uuid =') ||
    internalMessage.includes('service_categories')
  ) {
    return {
      status: 200,
      body: {
        success: true,
        categories: [],
        total: 0,
        message: 'Service categories temporarily unavailable',
      },
    };
  }

  if (
    internalMessage.includes('payment_gateways') ||
    internalMessage.includes('payment_gateway') ||
    (internalMessage.includes('relation') && internalMessage.includes('payment'))
  ) {
    return {
      status: 200,
      body: {
        success: true,
        gateways: [],
        message: 'Payment gateways temporarily unavailable',
      },
    };
  }

  if (path.includes('onboarding/roles') || (path.includes('roles') && path.includes('onboarding'))) {
    return {
      status: 200,
      body: {
        success: true,
        data: { roles: [] },
        message: 'Roles temporarily unavailable',
      },
    };
  }

  if (path.includes('profile/unified') || path.includes('customer/profile/unified')) {
    return {
      status: 200,
      body: {
        success: true,
        profile: null,
        _degraded: true,
        message: 'Profile temporarily unavailable',
      },
    };
  }

  if (path.includes('previous-providers')) {
    return { status: 200, body: { success: true, providers: [], total: 0 } };
  }

  if (path.includes('problems/trending')) {
    return { status: 200, body: { success: true, trending: [], total: 0 } };
  }

  if (path.includes('problem-grid')) {
    return { status: 200, body: { success: true, problems: [], byCategory: {} } };
  }

  if (path.includes('recommended-services')) {
    return { status: 200, body: { success: true, services: [] } };
  }

  if (path.includes('search-suggestions')) {
    return { status: 200, body: { success: true, suggestions: [], count: 0 } };
  }

  if (path === '/search' || path.endsWith('/search')) {
    return {
      status: 200,
      body: {
        query: options.searchQuery || '',
        categories: [],
        taxonomyResolvedHub: null,
        taxonomySource: 'none',
        effectiveCategory: null,
        categorySource: 'none',
        hubDrivenRetrieval: false,
        searchText: '',
        vendors: [],
        services: [],
        total: 0,
        searchMethod: 'sql',
      },
    };
  }

  if (path.includes('orders/meals/active')) {
    return { status: 200, body: { success: true, orders: [] } };
  }

  if (path.includes('adoption-stats')) {
    return {
      status: 200,
      body: {
        success: true,
        stats: { adoptablePets: 50, certifiedBreeders: 30, rehomingListings: 20 },
      },
    };
  }

  if (path.includes('notifications') && path.includes('customer')) {
    return { status: 200, body: { success: true, notifications: [], unreadCount: 0 } };
  }

  const isCustomerPetListRoute =
    path.includes('/pets/') &&
    path.includes('customer') &&
    method === 'GET' &&
    !/\/customer\/[^/]+\/pets\/[^/]+/.test(path);
  if (isCustomerPetListRoute) {
    return { status: 200, body: { success: true, pets: [], count: 0 } };
  }

  if (path.includes('service-launch') && path.includes('customer')) {
    return {
      status: 200,
      body: {
        success: true,
        location: { state: null, stateCode: null, city: null },
        services: { visible: [], comingSoon: [], hidden: [] },
        buttons: [],
      },
    };
  }

  if (path.includes('reminders/upcoming')) {
    return { status: 200, body: { success: true, reminders: [] } };
  }

  if (path.includes('reviews/pending')) {
    return { status: 200, body: { success: true, reviews: [], pending: [] } };
  }

  if (path.includes('customer/appointments')) {
    const idSegment = path.match(/\/customer\/appointments\/([^/?#]+)/);
    if (idSegment?.[1]) {
      return {
        status: 404,
        body: { error: 'Appointment not found', _degraded: true },
      };
    }
    return {
      status: 200,
      body: {
        appointments: [],
        count: 0,
        message: 'No booking',
        _degraded: true,
      },
    };
  }

  if (path.includes('/appointment/customer')) {
    return {
      status: 200,
      body: {
        appointments: [],
        count: 0,
        message: 'No booking',
        _degraded: true,
      },
    };
  }

  if (path.includes('/appointment/')) {
    return {
      status: 404,
      body: { error: 'Appointment not found', _degraded: true },
    };
  }

  return { status: 500, body: { error: SAFE_INTERNAL_ERROR_MESSAGE } };
}
