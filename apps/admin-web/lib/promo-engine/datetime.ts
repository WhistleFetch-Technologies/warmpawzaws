/**
 * datetime-local value for the promo wizard. Detail APIs return UTC ISO (`Z`);
 * browsers reject that in `type="datetime-local"` and the next save would wipe dates.
 */
export function toDatetimeLocalIst(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(
    ist.getUTCHours()
  )}:${pad(ist.getUTCMinutes())}`;
}
