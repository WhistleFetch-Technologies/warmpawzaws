/**
 * Opaque cursor for discovery list feeds.
 * v1: `{ o: resultOffset, s: sqlOffset }` for paginating enriched results + SQL windows.
 */

export type DiscoveryCursorPayload = { o: number; s: number };

export function decodeDiscoveryCursor(cursor?: string | null): DiscoveryCursorPayload {
  if (!cursor || !String(cursor).trim()) return { o: 0, s: 0 };
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const json = JSON.parse(raw) as Partial<DiscoveryCursorPayload> & { o?: number };
    const o = Number(json?.o);
    const s = Number(json?.s);
    return {
      o: Number.isFinite(o) && o >= 0 ? Math.floor(o) : 0,
      s: Number.isFinite(s) && s >= 0 ? Math.floor(s) : 0,
    };
  } catch {
    const legacy = parseInt(String(cursor), 10);
    if (Number.isFinite(legacy) && legacy >= 0) return { o: 0, s: legacy };
    return { o: 0, s: 0 };
  }
}

export function encodeDiscoveryCursor(payload: DiscoveryCursorPayload): string {
  const o = Math.max(0, Math.floor(payload.o));
  const s = Math.max(0, Math.floor(payload.s));
  return Buffer.from(JSON.stringify({ o, s } satisfies DiscoveryCursorPayload), 'utf8').toString(
    'base64url'
  );
}
