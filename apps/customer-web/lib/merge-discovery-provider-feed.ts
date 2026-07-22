/**
 * When by-style feed rows refresh (coords, pagination), preserve lazy-loaded vendor services.
 */
export type DiscoveryProviderWithLazyServices = {
  providerId: string;
  services?: unknown[];
  servicesHydrated?: boolean;
  servicesNextCursor?: string | null;
  servicesLoadingMore?: boolean;
};

export function mergeDiscoveryProvidersPreservingServices<T extends DiscoveryProviderWithLazyServices>(
  prev: T[],
  mapped: T[]
): T[] {
  const prevById = new Map(prev.map((p) => [p.providerId, p]));
  return mapped.map((next) => {
    const existing = prevById.get(next.providerId);
    if (!existing?.servicesHydrated) return next;
    return {
      ...next,
      services: existing.services,
      servicesHydrated: true,
      servicesNextCursor: existing.servicesNextCursor ?? null,
      servicesLoadingMore: false,
    };
  });
}
