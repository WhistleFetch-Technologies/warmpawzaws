import type { ClinicServiceRow } from '@/lib/clinic-service-row-mapper';

const TELE_STYLE_ALIASES = new Set([
  'tele',
  'video',
  'video_call',
  'video_consult',
  'video_consultation',
  'online',
  'online_consult',
  'online_consultation',
  'virtual',
]);

/** Map catalogue / search style spellings to the booking style keys; every tele spelling → `tele`. */
export function normalizeSearchServiceStyle(raw?: string | null): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return '';
  if (TELE_STYLE_ALIASES.has(key) || key.includes('tele')) return 'tele';
  return key;
}

const TELE_NAME_RE = /\btele|\b(video|online|virtual)\s*(call|consult)/i;

/**
 * Search results often omit a style. Recover it from the service row (metadata, then name) so a
 * tele service never falls into the Commerce Switch Pay Bill branch.
 */
export function inferSearchServiceStyle(
  service: Pick<ClinicServiceRow, 'name' | 'metadata'> | null | undefined,
): string {
  const meta =
    service?.metadata && typeof service.metadata === 'object'
      ? (service.metadata as Record<string, unknown>)
      : null;
  const fromMeta = normalizeSearchServiceStyle(
    String(meta?.service_style ?? meta?.serviceStyle ?? meta?.service_type ?? ''),
  );
  if (fromMeta) return fromMeta;
  return TELE_NAME_RE.test(String(service?.name ?? '')) ? 'tele' : '';
}

export function resolveSearchServiceStyle(
  explicit: string | null | undefined,
  service: Pick<ClinicServiceRow, 'name' | 'metadata'> | null | undefined,
): string | undefined {
  return normalizeSearchServiceStyle(explicit) || inferSearchServiceStyle(service) || undefined;
}
