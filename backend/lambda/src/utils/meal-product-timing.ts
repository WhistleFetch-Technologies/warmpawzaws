/**
 * Kitchen prep (minutes) vs customer booking lead time (hours) for meal products.
 * Legacy bug: preparationLeadTime was mapped to lead_time_hours — treat it as prep minutes only.
 */

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseOrderCutoffHm(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return HH_MM.test(t) ? t : null;
}

export function resolvePrepTimeMinutes(
  meta: Record<string, unknown>,
  rowPrepMinutes?: number | null,
): number {
  const fromMeta =
    meta.prepTimeMinutes != null
      ? Number(meta.prepTimeMinutes)
      : meta.preparationLeadTime != null
        ? Number(meta.preparationLeadTime)
        : NaN;
  if (Number.isFinite(fromMeta) && fromMeta >= 1 && fromMeta <= 24 * 60) {
    return Math.round(fromMeta);
  }
  if (rowPrepMinutes != null && Number.isFinite(Number(rowPrepMinutes)) && Number(rowPrepMinutes) >= 1) {
    return Math.round(Number(rowPrepMinutes));
  }
  return 60;
}

export function resolveLeadTimeHours(
  meta: Record<string, unknown>,
  rowLeadHours?: number | null,
  defaultHours = 24,
): number {
  if (meta.leadTimeHours != null) {
    const h = Number(meta.leadTimeHours);
    if (Number.isFinite(h) && h >= 0) return Math.round(h);
  }
  if (rowLeadHours != null) {
    const h = Number(rowLeadHours);
    if (Number.isFinite(h) && h >= 0) return Math.round(h);
  }
  return defaultHours;
}

export function resolveOrderCutoffTime(
  meta: Record<string, unknown>,
  rowCutoff?: string | null,
  platformDefault = '18:00',
): string {
  return (
    parseOrderCutoffHm(meta.orderCutoffTime) ||
    parseOrderCutoffHm(rowCutoff) ||
    platformDefault
  );
}
