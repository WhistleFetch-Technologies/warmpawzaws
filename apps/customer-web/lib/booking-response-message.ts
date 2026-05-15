/**
 * Booking APIs use BaseHandlerEnhanced: { success, data: { message, ... }, meta }.
 * Some older paths return a flat body. These helpers normalize both.
 */

export function getBookingResponsePayload(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') return {};
  const r = result as Record<string, unknown>;
  const data = r.data;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return r;
}

export function pickBookingApiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  const nested = o.data;
  if (nested && typeof nested === 'object') {
    const m = (nested as Record<string, unknown>).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  const top = o.message;
  if (typeof top === 'string' && top.trim()) return top.trim();
  return fallback;
}
