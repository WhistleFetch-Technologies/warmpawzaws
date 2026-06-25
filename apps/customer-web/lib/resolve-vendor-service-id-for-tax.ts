const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Flatten vendor services API payloads into a single array. */
export function flattenVendorServicesResponse(vendorServicesRes: unknown): any[] {
  if (!vendorServicesRes || typeof vendorServicesRes !== 'object') {
    return Array.isArray(vendorServicesRes) ? vendorServicesRes : [];
  }
  const res = vendorServicesRes as Record<string, unknown>;
  if (Array.isArray(res.allServices)) return res.allServices as any[];
  if (res.services && typeof res.services === 'object' && !Array.isArray(res.services)) {
    return Object.values(res.services as Record<string, unknown>).flatMap((style) => {
      const row = style as { services?: unknown };
      return Array.isArray(row?.services) ? row.services : [];
    });
  }
  if (Array.isArray(res.services)) return res.services as any[];
  const data = res.data as { services?: unknown } | undefined;
  if (Array.isArray(data?.services)) return data.services as any[];
  return [];
}

/**
 * Prefer vendor_services.id for GST/booking APIs.
 * Maps service_catalog.id (catalog UUID) to the vendor's published row when possible.
 */
export function resolveVendorServiceIdForTax(
  services: any[],
  serviceId: string | undefined,
): string | undefined {
  if (!serviceId || !Array.isArray(services) || services.length === 0) {
    return serviceId;
  }
  const sid = String(serviceId);
  const byVendorRow = services.find((s) => String(s?.id ?? '') === sid);
  if (byVendorRow?.id && UUID_RE.test(String(byVendorRow.id))) {
    return String(byVendorRow.id);
  }
  const byCatalog = services.find(
    (s) =>
      String(s?.service_id ?? s?.serviceId ?? s?.catalogId ?? s?.catalog_id ?? '') === sid,
  );
  if (byCatalog?.id && UUID_RE.test(String(byCatalog.id))) {
    return String(byCatalog.id);
  }
  return UUID_RE.test(sid) ? sid : sid;
}
