import { parseJsonbStringArray } from '../../utils/vendor-promotion-engine';

export { parseJsonbStringArray };

export function parseNum(value: unknown, fallback = 0): number {
  const n = parseFloat(String(value ?? fallback));
  return Number.isFinite(n) ? n : fallback;
}

export function parseIntSafe(value: unknown, fallback = 0): number {
  const n = parseInt(String(value ?? fallback), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

export function parseServicesList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

export function rowToRecord(row: unknown): Record<string, unknown> {
  if (row && typeof row === 'object') return row as Record<string, unknown>;
  return {};
}

export function resolveTriggerFromCode(code: unknown): 'AUTO' | 'CODE' {
  const c = parseOptionalString(code);
  return c ? 'CODE' : 'AUTO';
}
