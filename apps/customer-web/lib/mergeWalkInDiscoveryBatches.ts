import type {
  FeaturedProvider,
  FeaturedProviderCategory,
} from '@/lib/featured-provider';

export type WalkInProvider = FeaturedProvider & {
  category: FeaturedProviderCategory;
};

export type WalkInDiscoveryBatch = {
  category: FeaturedProviderCategory;
  providers: FeaturedProvider[];
};

function distanceSortKey(km: number | null): number {
  if (km == null || !Number.isFinite(km) || km < 0) return Number.POSITIVE_INFINITY;
  return km;
}

function pickNearer(
  a: WalkInProvider,
  b: WalkInProvider
): WalkInProvider {
  const aKey = distanceSortKey(a.distanceKm);
  const bKey = distanceSortKey(b.distanceKm);
  if (aKey !== bKey) return aKey <= bKey ? a : b;
  return a;
}

/**
 * Merge normalized walk-in discovery batches: dedupe by vendor id (keep nearest),
 * sort by distance ascending, cap at limit.
 */
export function mergeWalkInDiscoveryBatches(
  batches: WalkInDiscoveryBatch[],
  options?: { limit?: number }
): WalkInProvider[] {
  const limit = options?.limit ?? 8;
  const byId = new Map<string, WalkInProvider>();

  for (const batch of batches) {
    for (const provider of batch.providers) {
      const id = String(provider.id || '').trim();
      if (!id) continue;
      const tagged: WalkInProvider = { ...provider, category: batch.category };
      const existing = byId.get(id);
      byId.set(id, existing ? pickNearer(existing, tagged) : tagged);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const diff = distanceSortKey(a.distanceKm) - distanceSortKey(b.distanceKm);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, limit);
}
