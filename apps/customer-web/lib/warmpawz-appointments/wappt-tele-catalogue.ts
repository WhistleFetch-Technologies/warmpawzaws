import { apiClient } from '@/lib/api-client';
import { discoveryVendorList } from '@/lib/discovery-list';
import { isWarmpawzTeleCatalogueEnabled } from '@/lib/warmpawz-appointments-customer';
import { vendorServicesRowsFromResponse } from '@/lib/vendor-services-page';

export function resolveTeleConsultShellNavigation(): {
  screen: string;
  data: Record<string, unknown>;
} {
  if (isWarmpawzTeleCatalogueEnabled()) {
    return {
      screen: 'wappt-discovery',
      data: { category: 'vet', serviceStyle: 'tele', lockStyleFilter: true },
    };
  }
  return {
    screen: 'vet-tele-consultation',
    data: { startStep: 'scheduled' },
  };
}

export async function fetchWapptTeleMinPrice(): Promise<number | null> {
  if (!isWarmpawzTeleCatalogueEnabled()) return null;
  try {
    const res = await apiClient.get<Record<string, unknown>>(
      '/customer/warmpawz-appointments/discovery/by-category?category=vet&serviceStyle=tele&limit=10',
    );
    const vendors = discoveryVendorList(res);
    const prices: number[] = [];
    await Promise.all(
      vendors.slice(0, 5).map(async (row) => {
        const vendorId = String(
          (row as Record<string, unknown>).vendorId ??
            (row as Record<string, unknown>).id ??
            '',
        ).trim();
        if (!vendorId) return;
        try {
          const svcRes = await apiClient.get<Record<string, unknown>>(
            `/customer/vendor/${encodeURIComponent(vendorId)}/services?serviceStyle=tele&category=vet`,
          );
          const services = vendorServicesRowsFromResponse(svcRes);
          for (const s of services) {
            const n = Number((s as Record<string, unknown>).price);
            if (Number.isFinite(n) && n > 0) prices.push(n);
          }
        } catch {
          /* skip vendor */
        }
      }),
    );
    return prices.length > 0 ? Math.min(...prices) : null;
  } catch (e) {
    console.warn('[wappt-tele] min price fetch failed', e);
    return null;
  }
}
