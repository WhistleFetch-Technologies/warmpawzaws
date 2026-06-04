/** Temporary runtime tracing for taxonomy q injection investigation. */
export const TARGET_TAXONOMY_COMMA_STRING =
  'Vet near me, Dog doctor, Cat doctor, Pet clinic, Animal hospital';

const TARGET_SNIPPET = 'dog doctor';
function payloadHitsTarget(payload: Record<string, unknown>): boolean {
  const json = JSON.stringify(payload);
  return (
    json.toLowerCase().includes(TARGET_SNIPPET) ||
    json.includes('Vet near me') ||
    json.includes('Pet clinic') ||
    (json.includes('Dog doctor') && json.includes('Animal hospital'))
  );
}

export function traceSearch(label: string, payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const hit = payloadHitsTarget(payload);
  console.log(`[search-trace] ${label}`, payload);
  if (hit) {
    console.warn(`[search-trace] *** TARGET STRING DETECTED in ${label} ***`, payload);
    console.trace('[search-trace] stack');
  }
}

/** Home → router.push(`/search?q=…`) upstream tracing. */
export function traceHomeSearchUpstream(
  label: string,
  payload: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  const hit = payloadHitsTarget(payload);
  console.log(`[search-trace-upstream] ${label}`, payload);
  if (hit) {
    console.warn(`[search-trace-upstream] *** TARGET / router.push payload in ${label} ***`, payload);
    console.trace('[search-trace-upstream] stack');
  }
}

export function searchPersistenceContainsTarget(value: unknown): boolean {
  if (value == null) return false;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return (
    s.includes(TARGET_TAXONOMY_COMMA_STRING) ||
    (s.includes('Dog doctor') && s.includes('Animal hospital'))
  );
}

/** Scan persistence payloads for the comma-separated taxonomy string. */
export function traceSearchPersistence(
  label: string,
  payload: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  const hit = searchPersistenceContainsTarget(payload);
  console.log(`[search-persistence] ${label}`, payload);
  if (hit) {
    console.warn(
      `[search-persistence] *** TARGET FOUND in ${label} ***`,
      payload
    );
  }
}

/** Snapshot all search-related localStorage keys on load. */
export function logSearchLocalStorageOnLoad(customerId?: string): void {
  if (typeof window === 'undefined') return;
  const snapshot: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !/search|warmpawz/i.test(key)) continue;
    snapshot[key] = localStorage.getItem(key);
  }
  traceSearchPersistence('pageLoad.localStorage', {
    customerId: customerId || null,
    keys: Object.keys(snapshot),
    snapshot,
    targetInSnapshot: Object.entries(snapshot).filter(([, v]) =>
      searchPersistenceContainsTarget(v)
    ),
  });
}