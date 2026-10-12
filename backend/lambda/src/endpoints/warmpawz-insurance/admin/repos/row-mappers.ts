/** Shared pg row readers for insurance admin repos. */

export type Row = Record<string, unknown>;

export function str(v: unknown): string | null {
  return v == null ? null : String(v);
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** DATE columns arrive as Date (local midnight) or "YYYY-MM-DD". */
export function isoDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

export function isoTs(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function intArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number).filter(Number.isFinite);
  if (typeof v === 'string') {
    return v
      .replace(/[{}]/g, '')
      .split(',')
      .filter((s) => s.trim() !== '')
      .map((s) => Number(s.trim()))
      .filter(Number.isFinite);
  }
  return [];
}

export function textArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.startsWith('{')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return [];
}

export function vendorDisplayName(row: Row): string {
  return str(row.business_name)?.trim() || str(row.owner_name)?.trim() || 'Unnamed vendor';
}
