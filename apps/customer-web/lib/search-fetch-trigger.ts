export type SearchFetchTrigger =
  | { kind: 'keyword'; q: string; n: number }
  | { kind: 'hub'; c: string; n: number }
  | { kind: 'browse'; n: number };

export function buildSearchFetchTrigger(
  query: string,
  category: string,
  vendorIdParam: string | null,
  searchNonce: number
): SearchFetchTrigger | null {
  if (vendorIdParam) return null;
  const q = (query || '').trim();
  const c = (category || '').trim();
  if (q) return { kind: 'keyword', q, n: searchNonce };
  if (c) return { kind: 'hub', c, n: searchNonce };
  return { kind: 'browse', n: searchNonce };
}
