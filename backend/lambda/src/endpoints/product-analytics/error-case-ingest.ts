/**
 * Fingerprint + upsert into product_error_cases / error_case_occurrences after analytics_events insert.
 */
import type { PoolClient } from 'pg';
import { createHash } from 'crypto';
import type { AnalyticsApp } from './schemas';

/** Keys omitted from fingerprint only — full JSON still stored on analytics_events for triage UI. */
const PROPERTIES_OMITTED_FROM_FINGERPRINT = new Set([
  'stack',
  'componentStack',
]);

/**
 * Strip volatile substrings inside property values (timestamps, UUIDs, large numeric ids).
 * Uses `\d{10,}` without `\b` so suffixes like `test_1777267925314` still normalize (`_` breaks \b word boundaries).
 */
function normalizeVolatileTokens(s: string): string {
  return s
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d{10,}/g, '<n>')
    .replace(/\b0x[0-9a-f]{8,}\b/gi, '<hex>');
}

/** Shallow copy omitting keys that almost always differ per throw but are not needed for “same issue” grouping. */
function propertiesForFingerprint(properties: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (PROPERTIES_OMITTED_FROM_FINGERPRINT.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Stable JSON-ish tree for fingerprinting: sorted object keys, volatile strings normalized.
 */
function normalizeForFingerprintTree(v: unknown): unknown {
  if (v === null || v === undefined) {
    return v;
  }
  if (typeof v === 'string') {
    return normalizeVolatileTokens(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map(normalizeForFingerprintTree);
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      sorted[k] = normalizeForFingerprintTree(o[k]);
    }
    return sorted;
  }
  return v;
}

/**
 * Stable 64-char hex: same app + error_code + event_name + normalized (non-stack) properties ⇒ one case.
 */
export function computeErrorFingerprint(input: {
  app: AnalyticsApp | string;
  error_code: string | null | undefined;
  event_name: string;
  properties: Record<string, unknown>;
}): string {
  const fpProps = propertiesForFingerprint(input.properties ?? {});
  const canonical = normalizeForFingerprintTree(fpProps);
  const canonJson = JSON.stringify(canonical);
  const payload = `${input.app}|${input.error_code ?? 'unknown'}|${input.event_name}|${canonJson}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function deriveCaseTitle(ev: {
  event_name: string;
  properties: Record<string, unknown>;
}): string {
  const m = ev.properties?.message ?? ev.properties?.error_message;
  if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 300);
  return ev.event_name.slice(0, 256);
}

export async function upsertProductErrorCasesForInsertedEvents(
  client: PoolClient,
  inserted: Array<{
    id: string;
    app: AnalyticsApp | string;
    event_name: string;
    error_code: string | null;
    properties: Record<string, unknown>;
  }>
): Promise<void> {
  for (const row of inserted) {
    const fingerprint = computeErrorFingerprint(row);
    const title = deriveCaseTitle(row);

    const upsert = await client.query<{ id: string }>(
      `INSERT INTO product_error_cases (fingerprint, title, first_seen_at, last_seen_at, occurrence_count)
       VALUES ($1::varchar(64), $2::text, now(), now(), 1)
       ON CONFLICT (fingerprint) DO UPDATE SET
         last_seen_at = now(),
         occurrence_count = product_error_cases.occurrence_count + 1,
         updated_at = now(),
         title = CASE
           WHEN COALESCE(product_error_cases.title, '') = '' THEN EXCLUDED.title
           ELSE product_error_cases.title
         END
       RETURNING id`,
      [fingerprint, title]
    );

    const caseId = upsert.rows[0]?.id;
    if (!caseId) continue;

    await client.query(
      `INSERT INTO error_case_occurrences (case_id, event_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (event_id) DO NOTHING`,
      [caseId, row.id]
    );
  }
}
