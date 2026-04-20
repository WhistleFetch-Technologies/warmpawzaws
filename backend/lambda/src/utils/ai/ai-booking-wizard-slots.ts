/**
 * Slot list helpers for AI booking wizard commit validation.
 * Keeps logic testable without importing the large available-slots handler.
 */

export type SlotRow = { time?: string; available?: boolean };

export function normalizeSlotTime(t: string): string {
  const s = String(t || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return s;
  const h = m[1].padStart(2, '0');
  const min = m[2].padStart(2, '0');
  const sec = m[3] != null ? `:${m[3].padStart(2, '0')}` : '';
  return sec ? `${h}:${min}${sec}` : `${h}:${min}`;
}

/** Compare by hour:minute so 10:00 matches API rows like 10:00:00. */
function toHHMMKey(t: string): string {
  const n = normalizeSlotTime(t);
  const m = n.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : n;
}

export function extractSlotsFromApiPayload(payload: unknown): SlotRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const raw = p.slots;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as SlotRow[];
}

export function isSlotTimeAvailable(slotTime: string, slots: SlotRow[]): boolean {
  const want = toHHMMKey(slotTime);
  return slots.some((s) => {
    if (s.available === false) return false;
    const t = toHHMMKey(String(s.time || ''));
    return t === want || String(s.time || '').trim() === String(slotTime).trim();
  });
}

export function parseSlotsSnapshotJson(text: string | null | undefined): SlotRow[] {
  if (!text || typeof text !== 'string') return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed as SlotRow[];
    if (parsed && typeof parsed === 'object') {
      return extractSlotsFromApiPayload(parsed);
    }
  } catch {
    return [];
  }
  return [];
}
