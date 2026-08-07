import { apiClient } from '@/lib/api-client';
import { discoveryVendorList } from '@/lib/discovery-list';

/** Inclusive merge: clinic + tele + home so experts appear even when not published as at_center only. */
const NUTRITION_DISCOVERY_STYLES = ['at_center', 'tele', 'at_home'] as const;

export async function fetchMergedNutritionProviders(options: { customerPhone: string }): Promise<any[]> {
  const { customerPhone } = options;
  const phoneQ = `&customerPhone=${encodeURIComponent(customerPhone)}`;
  const base = `category=nutrition${phoneQ}`;

  const results = await Promise.all(
    NUTRITION_DISCOVERY_STYLES.map((style) =>
      apiClient
        .get<{
          vendors?: any[];
          providers?: any[];
        }>(`/customer/discover-services?${base}&serviceStyle=${style}`)
        .catch(() => ({ vendors: [] as any[], providers: [] as any[] }))
    )
  );

  const byId = new Map<string, any>();
  for (const res of results) {
    const list = discoveryVendorList(res);
    for (const p of list) {
      const id = p?.id ?? p?.vendorId;
      if (id && !byId.has(String(id))) {
        byId.set(String(id), p);
      }
    }
  }
  return Array.from(byId.values());
}
