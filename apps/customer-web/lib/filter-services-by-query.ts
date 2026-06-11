/** Whitespace-separated query → lowercase tokens (cap avoids huge input). */
export function searchQueryTokens(query: string, maxTokens = 6): string[] {
  return String(query || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .slice(0, maxTokens);
}

type SearchableService = {
  name?: string | null;
  serviceName?: string | null;
  description?: string | null;
  category?: string | null;
  categoryName?: string | null;
  tags?: string[] | null;
};

function getServiceSearchHaystack(service: SearchableService): string {
  const parts: string[] = [];
  for (const value of [
    service.name,
    service.serviceName,
    service.description,
    service.category,
    service.categoryName,
  ]) {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  }
  if (Array.isArray(service.tags)) {
    for (const tag of service.tags) {
      if (typeof tag === 'string' && tag.trim()) {
        parts.push(tag.trim());
      }
    }
  }
  return parts.join(' ').toLowerCase();
}

/** Every query token must appear in name, description, category, or tags. */
export function filterServicesByQuery<T extends SearchableService>(
  services: T[],
  query: string
): T[] {
  const tokens = searchQueryTokens(query);
  if (tokens.length === 0) return services;

  return services.filter((service) => {
    const haystack = getServiceSearchHaystack(service);
    return tokens.every((token) => haystack.includes(token));
  });
}
