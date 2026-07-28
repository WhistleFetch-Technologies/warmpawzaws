/**
 * Map discovery list vendor rows (VendorCardDTO / legacy shapes) to UI provider fields.
 */
import { normalizeProviderListPhoto } from './resolve-display-image-url';
import { resolveNextAvailableLabel } from './available-slots-response';

export type DiscoveryListRow = Record<string, unknown>;

export function discoveryRowId(row: DiscoveryListRow): string {
  return String(row.vendorId ?? row.id ?? row.providerId ?? '').trim();
}

export function discoveryRowDisplayName(row: DiscoveryListRow, fallback = 'Provider'): string {
  const raw = row.name ?? row.businessName ?? row.vendorName ?? fallback;
  return String(raw).trim() || fallback;
}

/** Strip trailing UUID fragments from display names (existing UI behaviour). */
export function cleanDiscoveryProviderName(name: string): string {
  return name
    .replace(/\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '')
    .trim();
}

export function mapDiscoveryRowBaseFields(row: DiscoveryListRow) {
  const id = discoveryRowId(row);
  const name = cleanDiscoveryProviderName(discoveryRowDisplayName(row));
  const reviewCount = Number(row.reviewCount ?? row.review_count ?? 0) || 0;
  const rawRating = row.rating != null ? Number(row.rating) : NaN;
  const rating =
    reviewCount > 0 && Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0;

  const nextAvailableSlot = resolveNextAvailableLabel(row) ?? undefined;

  return {
    id,
    providerId: id,
    vendorId: String(row.vendorId ?? row.id ?? id),
    name,
    vendorName: row.vendorName ? cleanDiscoveryProviderName(String(row.vendorName)) : undefined,
    businessName: row.businessName
      ? cleanDiscoveryProviderName(String(row.businessName))
      : undefined,
    photo: normalizeProviderListPhoto(row),
    address: row.address as string | undefined,
    city: row.city as string | undefined,
    phone: row.phone as string | undefined,
    role: (row.role ?? row.roleDisplayName ?? row.roleName) as string | undefined,
    roleDisplayName: (row.roleDisplayName ?? row.roleName ?? row.role) as string | undefined,
    roleName: (row.roleName ?? row.role) as string | undefined,
    roleId: (row.roleId ?? row.role_id) as string | null | undefined,
    experienceYears: row.experienceYears as number | undefined,
    qualifications: row.qualifications as string | undefined,
    rating,
    reviewCount,
    distance: row.distanceKm ?? row.distance ?? null,
    isVerified: Boolean(row.isVerified ?? row.verified),
    isOnline: Boolean(row.isOnline ?? row.is_online),
    isIndividualProvider: Boolean(row.isIndividualProvider),
    specialization: (row.specialization ?? row.specialisation) as string | undefined,
    specializations: Array.isArray(row.specializations)
      ? (row.specializations as string[])
      : undefined,
    priceMin: row.priceMin != null ? Number(row.priceMin) : undefined,
    warmpawzAppointments: row.warmpawzAppointments === true,
    nextAvailableSlot,
    services: Array.isArray(row.services) ? row.services : [],
    raw: row,
  };
}
