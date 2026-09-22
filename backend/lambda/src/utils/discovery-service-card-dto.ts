/**
 * Slim service card for View Services feed (Screen 3).
 * Keeps package flags + lite packageDetails so Book Now can open purchase-package.
 */

export type ServiceCardPackageDetails = {
  totalSessions?: number;
  sessionsPerDay?: number;
  sessionIntervalDays?: number;
  durationDays?: number;
  price?: number;
};

export type ServiceCardDTO = {
  id: string;
  name: string;
  shortDescription: string | null;
  /** Full vendor/catalog copy for View more. */
  description: string | null;
  duration: number | null;
  categoryLabel: string | null;
  price: number | null;
  isPackage: boolean;
  serviceStyle: string | null;
  /** Lite package meta for discovery → purchase-package (not full vendor metadata). */
  packageDetails?: ServiceCardPackageDetails | null;
};

function pickPackageDetails(row: Record<string, unknown>): ServiceCardPackageDetails | null {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : undefined;
  const raw =
    (row.packageDetails as Record<string, unknown> | undefined) ||
    (meta?.packageDetails as Record<string, unknown> | undefined);
  if (!raw || typeof raw !== "object") return null;

  const out: ServiceCardPackageDetails = {};
  if (raw.totalSessions != null && Number.isFinite(Number(raw.totalSessions))) {
    out.totalSessions = Number(raw.totalSessions);
  }
  if (raw.sessionsPerDay != null && Number.isFinite(Number(raw.sessionsPerDay))) {
    out.sessionsPerDay = Number(raw.sessionsPerDay);
  }
  if (raw.sessionIntervalDays != null && Number.isFinite(Number(raw.sessionIntervalDays))) {
    out.sessionIntervalDays = Number(raw.sessionIntervalDays);
  }
  if (raw.durationDays != null && Number.isFinite(Number(raw.durationDays))) {
    out.durationDays = Number(raw.durationDays);
  }
  if (raw.price != null && Number.isFinite(Number(raw.price))) {
    out.price = Number(raw.price);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function toServiceCardDTO(
  row: Record<string, unknown>,
  options?: { omitPricing?: boolean },
): ServiceCardDTO {
  const desc =
    (row.longDescription as string) ||
    (row.description as string) ||
    (row.catalog_description as string) ||
    (row.shortDescription as string) ||
    null;
  const fullDescription = desc && String(desc).trim() ? String(desc).trim() : null;
  const shortDescription =
    fullDescription && fullDescription.length > 120
      ? `${fullDescription.slice(0, 117)}...`
      : fullDescription;

  const omitPricing = options?.omitPricing === true;
  const rawPrice =
    row.price != null && Number.isFinite(Number(row.price))
      ? Number(row.price)
      : row.base_price != null
        ? Number(row.base_price)
        : null;
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : undefined;
  const packageDetails = pickPackageDetails(row);
  const isPackage = !!(
    row.isPackage ??
    row.is_package ??
    meta?.isPackage ??
    packageDetails
  );

  return {
    id: String(row.id ?? row.serviceId ?? ''),
    name: String(row.name ?? row.serviceName ?? ''),
    shortDescription,
    description: fullDescription,
    duration:
      row.duration != null
        ? Number(row.duration)
        : row.durationMinutes != null
          ? Number(row.durationMinutes)
          : null,
    categoryLabel:
      String(row.categoryLabel ?? row.categoryName ?? row.category ?? row.categorySlug ?? "") ||
      null,
    price: omitPricing ? null : rawPrice,
    isPackage,
    serviceStyle: (row.serviceStyle as string) ?? (row.service_style as string) ?? null,
    packageDetails: isPackage ? packageDetails : null,
  };
}

export function toServiceCardDTOList(
  rows: Record<string, unknown>[],
  options?: { omitPricing?: boolean },
): ServiceCardDTO[] {
  return rows.map((r) => toServiceCardDTO(r, options));
}
