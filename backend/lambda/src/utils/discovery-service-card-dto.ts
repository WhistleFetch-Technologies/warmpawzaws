/**
 * Slim service card for View Services feed (Screen 3).
 */

export type ServiceCardDTO = {
  id: string;
  name: string;
  shortDescription: string | null;
  duration: number | null;
  categoryLabel: string | null;
  price: number | null;
  isPackage: boolean;
  serviceStyle: string | null;
};

export function toServiceCardDTO(
  row: Record<string, unknown>,
  options?: { omitPricing?: boolean },
): ServiceCardDTO {
  const desc =
    (row.shortDescription as string) ||
    (row.description as string) ||
    (row.longDescription as string) ||
    null;
  const shortDescription =
    desc && desc.length > 120 ? `${desc.slice(0, 117)}...` : desc;

  const omitPricing = options?.omitPricing === true;
  const rawPrice =
    row.price != null && Number.isFinite(Number(row.price))
      ? Number(row.price)
      : row.base_price != null
        ? Number(row.base_price)
        : null;

  return {
    id: String(row.id ?? row.serviceId ?? ''),
    name: String(row.name ?? row.serviceName ?? ''),
    shortDescription,
    duration:
      row.duration != null
        ? Number(row.duration)
        : row.durationMinutes != null
          ? Number(row.durationMinutes)
          : null,
    categoryLabel: String(
      row.categoryLabel ?? row.categoryName ?? row.category ?? row.categorySlug ?? ''
    ) || null,
    price: omitPricing ? null : rawPrice,
    isPackage: !!(row.isPackage ?? row.is_package),
    serviceStyle: (row.serviceStyle as string) ?? (row.service_style as string) ?? null,
  };
}

export function toServiceCardDTOList(
  rows: Record<string, unknown>[],
  options?: { omitPricing?: boolean },
): ServiceCardDTO[] {
  return rows.map((r) => toServiceCardDTO(r, options));
}
