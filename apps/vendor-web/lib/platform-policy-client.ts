/**
 * Load admin-managed legal docs. Prefer /public/* (same DB as admin); fall back to /vendor/policies/:type.
 * tryGetJson swallows errors so a failing route (404/401/…) does not skip later fallbacks.
 */

export type PlatformPolicyTypeKey =
  | 'vendor_terms_of_service'
  | 'customer_terms_of_service'
  | 'privacy_policy';

export type PlatformPolicyRow = {
  policyType?: string;
  policy_type?: string;
  title?: string;
  content?: string;
};

function rowPolicyType(row: PlatformPolicyRow): string | undefined {
  const t = row.policyType ?? row.policy_type;
  return typeof t === 'string' && t.trim() ? t.trim() : undefined;
}

export function policyRowMatchesRequested(
  row: PlatformPolicyRow,
  requested: PlatformPolicyTypeKey
): boolean {
  const t = rowPolicyType(row);
  if (!t) return false;
  if (t === requested) return true;
  if (requested === 'vendor_terms_of_service' && t === 'terms_of_service') return true;
  return false;
}

type PoliciesApiResponse = {
  policies?: PlatformPolicyRow[];
  isDefault?: boolean;
  policySource?: 'defaults_only' | 'error_fallback';
};

function isPoliciesArray(res: unknown): res is PoliciesApiResponse {
  if (!res || typeof res !== 'object') return false;
  const p = (res as PoliciesApiResponse).policies;
  return Array.isArray(p) && p.length > 0;
}

function pickFromResponse(
  res: PoliciesApiResponse | null | undefined,
  requested: PlatformPolicyTypeKey
): { row: PlatformPolicyRow; res: PoliciesApiResponse } | null {
  if (!res || !isPoliciesArray(res)) return null;
  const list = res.policies!;
  const row = list.find((x) => policyRowMatchesRequested(x, requested));
  const content = row?.content;
  if (!row || typeof content !== 'string' || !content.trim()) return null;
  return { row, res };
}

async function tryGetJson<T>(
  getJson: <U>(path: string) => Promise<U>,
  path: string
): Promise<T | null> {
  try {
    return (await getJson<T>(path)) as T;
  } catch {
    return null;
  }
}

export async function fetchPlatformPolicyDocument(
  getJson: <T>(path: string) => Promise<T>,
  requested: PlatformPolicyTypeKey
): Promise<
  | { ok: true; title: string; content: string; notice?: string }
  | { ok: false; error: string }
> {
  const paths = [
    '/public/policies',
    `/public/policies?policyType=${encodeURIComponent(requested)}`,
    `/public/policies/${encodeURIComponent(requested)}`,
    `/vendor/policies/${encodeURIComponent(requested)}`,
  ] as const;

  let best: { row: PlatformPolicyRow; res: PoliciesApiResponse } | null = null;

  for (const path of paths) {
    const res = await tryGetJson<PoliciesApiResponse>(getJson, path);
    const picked = pickFromResponse(res, requested);
    if (picked) {
      best = picked;
      break;
    }
  }

  if (!best) {
    return { ok: false, error: 'No policies are available right now.' };
  }

  const { row: p, res } = best;

  let notice: string | undefined;
  if (res.policySource === 'error_fallback' || res.isDefault) {
    notice =
      'Policy database could not be read (AWS/RDS error). Showing built-in template text — not necessarily your latest admin edits. Check Lambda logs and RDS connectivity.';
  }

  return { ok: true, title: (p.title ?? '').trim(), content: p.content as string, notice };
}
