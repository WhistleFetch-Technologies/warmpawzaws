import { toServiceCardDTOList } from '../../../../../utils/discovery-service-card-dto';

export function stripVendorServicePrices<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    if (row.isPackage || row.is_package) return row;
    const meta = row.metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta) && Boolean((meta as { isPackage?: unknown }).isPackage)) {
      return row;
    }
    const { price: _p, base_price: _b, custom_price: _c, ...rest } = row;
    return rest as T;
  });
}

export function buildVendorServicesCardResponse(opts: {
  page: Record<string, unknown>[];
  nextCursor: string | null;
  omitPricing: boolean;
}) {
  const { page, nextCursor, omitPricing } = opts;
  return {
    success: true as const,
    services: toServiceCardDTOList(page, { omitPricing }),
    nextCursor,
    count: page.length,
    ...(omitPricing ? { warmpawzAppointments: true as const } : {}),
  };
}

export function buildVendorServicesLegacyResponse(opts: {
  services: Record<string, unknown>[];
  hasActivePackage: boolean;
  omitPricing: boolean;
}) {
  const { services, hasActivePackage, omitPricing } = opts;
  return {
    success: true as const,
    services,
    packages: services.filter((s) => s.isPackage),
    count: services.length,
    hasActivePackage,
    ...(omitPricing ? { warmpawzAppointments: true as const } : {}),
  };
}
