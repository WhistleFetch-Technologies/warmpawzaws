/**
 * Appointment route runtime helpers (move-only from customer-appointments monolith).
 */

import type { Context } from 'hono';

export const LIST_FALLBACK = {
  appointments: [] as unknown[],
  count: 0,
  message: 'No booking',
};

export const NOT_FOUND_FALLBACK = { error: 'Appointment not found' };

const LIST_EMPTY_OK = { appointments: [] as unknown[], count: 0, message: 'No booking' };

/** POST bodies: Hono req.json() → API Gateway event.body (move-only from monolith). */
export async function attachParsedJsonBody(c: Context, event: Record<string, unknown>): Promise<void> {
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  try {
    const j = await c.req.json();
    event.body = JSON.stringify(j != null && typeof j === 'object' && !Array.isArray(j) ? j : {});
  } catch {
    event.body = typeof event.body === 'string' && event.body.length > 0 ? event.body : '{}';
  }
}

export async function runAppointmentHandler(
  c: { json: (b: object, s?: number) => Response },
  exec: () => Promise<{ statusCode: number; body: string }>,
  parseFallbackBody: object,
  parseFallbackStatus: number,
  options?: { coerceListErrorsToEmpty?: boolean }
): Promise<Response> {
  try {
    const result = await exec();
    const raw = result?.body;

    if (options?.coerceListErrorsToEmpty && result.statusCode >= 400) {
      console.warn(
        '[appointments] list coerced from error status:',
        result.statusCode,
        typeof raw === 'string' ? raw.slice(0, 400) : raw
      );
      return c.json(LIST_EMPTY_OK, 200);
    }

    if (raw == null || raw === '') {
      console.warn('[appointments] empty handler body, using fallback');
      return c.json(parseFallbackBody, parseFallbackStatus);
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (options?.coerceListErrorsToEmpty && parsed.error != null && !Array.isArray(parsed.appointments)) {
        console.warn('[appointments] list coerced from error payload:', parsed.error);
        return c.json(LIST_EMPTY_OK, 200);
      }
      return c.json(parsed, result.statusCode);
    } catch {
      console.warn('[appointments] invalid handler JSON body, using fallback');
      return c.json(parseFallbackBody, parseFallbackStatus);
    }
  } catch (err) {
    console.warn('[appointments] route execute threw:', err);
    return c.json(parseFallbackBody, parseFallbackStatus);
  }
}
