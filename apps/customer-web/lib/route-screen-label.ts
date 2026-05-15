/**
 * Builds admin-friendly screen titles from `pathname` + optional query (same input as route tracking).
 * Raw paths stay out of customer-facing analytics names; smoke-test names like `deploy_verify` never appear from here.
 */

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function shortQueryHint(qs: string, max = 56): string {
  const trimmed = qs.trim();
  if (!trimmed) return '';
  try {
    const usp = new URLSearchParams(trimmed);
    const pairs = [...usp.entries()].slice(0, 4);
    const s = pairs.map(([k, v]) => {
      const vv = v.length > 16 ? `${v.slice(0, 16)}…` : v;
      return `${k}=${vv}`;
    }).join(', ');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  }
}

/** Canonical route key from Next.js `pathname` + query (same as route analytics). */
export function buildCustomerRouteKey(pathname: string | null, queryString: string): string {
  const path = pathname || '/';
  const qs = queryString.trim();
  return qs ? `${path}?${qs}` : path;
}

/** Next.js route key: `/foo/bar` or `/foo?a=1` — returns e.g. `Foo · Bar`, `Home`, `Shop (tab=vet)`. */
export function humanizeCustomerRouteScreen(routeKey: string): string {
  const raw = routeKey.trim().slice(0, 512);
  if (!raw) return 'Home';

  const qIdx = raw.indexOf('?');
  const pathPart = (qIdx === -1 ? raw : raw.slice(0, qIdx)).trim() || '/';
  const queryPart = qIdx === -1 ? '' : raw.slice(qIdx + 1).trim();

  const segments = pathPart.split('/').filter(Boolean);

  if (segments.length === 0) {
    return queryPart ? `Home (${shortQueryHint(queryPart)})` : 'Home';
  }

  const pathLabel = segments.map(titleCaseSegment).join(' · ');
  return queryPart ? `${pathLabel} (${shortQueryHint(queryPart)})` : pathLabel;
}
