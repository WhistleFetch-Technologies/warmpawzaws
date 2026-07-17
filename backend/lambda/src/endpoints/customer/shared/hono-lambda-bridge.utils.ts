import { randomUUID } from 'crypto';
import type { Context } from 'hono';

/** Orders-style API Gateway event shim (move-only from customer-orders monolith). */
export function createOrdersApiGatewayEvent(req: Context['req']): Record<string, unknown> {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: (req as { body?: unknown }).body ? JSON.stringify((req as { body?: unknown }).body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user',
        },
      },
    },
  };
}

/** Enhanced-style API Gateway event shim (move-only from customer-enhanced monolith). */
export function createEnhancedApiGatewayEvent(req: Context['req']): Record<string, unknown> {
  const url = typeof req.url === 'string' ? req.url : '';
  let queryStringParameters: Record<string, string> = {};
  try {
    queryStringParameters = Object.fromEntries(new URL(url).searchParams);
  } catch {
    queryStringParameters = req.query ? Object.fromEntries(Object.entries(req.query())) : {};
  }
  return {
    httpMethod: req.method,
    path: url,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    body: JSON.stringify((req as { body?: unknown }).body || {}),
    pathParameters: req.param ? req.param() : {},
    queryStringParameters,
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

/** Appointments-style API Gateway event shim (move-only from customer-appointments monolith). */
export function createAppointmentsApiGatewayEvent(req: Context['req']): Record<string, unknown> {
  let pathParameters: Record<string, string> = {};
  let queryStringParameters: Record<string, string> = {};
  let headers: Record<string, string> = {};

  try {
    if (typeof req.param === 'function') {
      const p = req.param();
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        pathParameters = { ...p };
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent pathParameters failed:', e);
  }

  try {
    if (typeof req.query === 'function') {
      const q = req.query();
      if (q && typeof q === 'object' && !Array.isArray(q)) {
        queryStringParameters = Object.fromEntries(
          Object.entries(q as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)])
        );
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent queryStringParameters failed:', e);
  }

  try {
    const urlStr = typeof req.url === 'string' ? req.url : '';
    if (urlStr.includes('?')) {
      const u =
        urlStr.startsWith('http://') || urlStr.startsWith('https://')
          ? new URL(urlStr)
          : new URL(urlStr, 'http://127.0.0.1');
      u.searchParams.forEach((value, key) => {
        if (value == null || key == null) return;
        if (!queryStringParameters[key] || queryStringParameters[key] === '') {
          queryStringParameters[key] = value;
        }
      });
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent URL query fallback failed:', e);
  }

  try {
    if (typeof req.header === 'function') {
      const h = req.header();
      if (h && typeof h === 'object') {
        headers = Object.fromEntries(
          Object.entries(h as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)])
        );
      }
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent headers failed:', e);
  }

  let body: string | null = null;
  try {
    const rb = (req as { body?: unknown }).body;
    if (rb != null && typeof rb !== 'undefined') {
      body = JSON.stringify(rb);
    }
  } catch (e) {
    console.warn('[appointments] createApiGatewayEvent body stringify skipped:', e);
    body = null;
  }

  const sub =
    typeof req.header === 'function'
      ? req.header('x-user-id') || headers['x-user-id'] || 'test-user'
      : 'test-user';

  return {
    pathParameters,
    queryStringParameters,
    body,
    headers,
    requestContext: {
      authorizer: {
        claims: { sub },
      },
    },
  };
}

export function createEmptyLambdaContext(): Record<string, unknown> {
  return {};
}

export function createEnhancedLambdaContext(): Record<string, unknown> {
  return {
    requestId: randomUUID(),
    functionName: 'customer-handler',
    functionVersion: '$LATEST',
  };
}

/** Appointments: merge all query keys from Hono onto event.queryStringParameters. */
export function mergeAllQueryFromHono(c: Context, event: Record<string, unknown>): void {
  try {
    const base: Record<string, string> = {
      ...((event.queryStringParameters as Record<string, string>) || {}),
    };
    if (typeof c.req.query === 'function') {
      const q = c.req.query();
      if (q && typeof q === 'object') {
        for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
          if (v == null) continue;
          base[k] = String(v);
        }
      }
    }
    event.queryStringParameters = base;
  } catch (e) {
    console.warn('[appointments] mergeAllQueryFromHono failed:', e);
  }
}
