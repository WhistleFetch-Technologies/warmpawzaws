/**
 * Slim vendor card for category/style discovery feeds (Screen 2B).
 */

export type VendorCardDTO = {
  id: string;
  vendorId: string;
  name: string;
  photoUrl: string | null;
  roleDisplayName: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isOnline: boolean;
  distanceKm: number | null;
  distanceText: string | null;
  shortAddress: string | null;
  priceMin?: number;
  availabilityText: string;
  nextAvailableSlot?: string;
  serviceStyle?: string;
  /** Vendor is in admin-published Warmpawz Appointments catalogue (flat-fee booking). */
  warmpawzAppointments?: boolean;
};

function shortAddressFromCard(card: Record<string, unknown>): string | null {
  const city = card.city != null ? String(card.city).trim() : '';
  const address = card.address != null ? String(card.address).trim() : '';
  if (address && city) {
    const combined = address.length > 60 ? `${address.slice(0, 57)}...` : address;
    return city !== combined ? `${combined}, ${city}` : combined;
  }
  return city || address || null;
}

function availabilityTextFromCard(card: Record<string, unknown>): string {
  const next = card.nextAvailable as { display?: string } | undefined;
  if (next?.display && String(next.display).trim()) return String(next.display);
  return 'Tap to view availability';
}

/** Map enriched list card → VendorCardDTO (drops phone, services[], specializations, etc.). */
export function toVendorCardDTO(
  card: Record<string, unknown>,
  serviceStyle?: string,
  options?: { warmpawzAppointments?: boolean },
): VendorCardDTO {
  const id = String(card.vendorId ?? card.id ?? '');
  const availabilityText = availabilityTextFromCard(card);
  const warmpawzAppointments =
    options?.warmpawzAppointments === true || card.warmpawzAppointments === true;
  return {
    id,
    vendorId: id,
    name: String(card.name ?? ''),
    photoUrl: (card.photoUrl as string | null) ?? null,
    roleDisplayName: String(card.roleDisplayName ?? card.roleName ?? ''),
    rating: Number(card.rating) || 0,
    reviewCount: Number(card.reviewCount) || 0,
    isVerified: card.isVerified !== false,
    isOnline: !!card.isOnline,
    distanceKm:
      card.distanceKm != null
        ? Number(card.distanceKm)
        : card.distance != null
          ? Number(card.distance)
          : null,
    distanceText: (card.distanceText as string | null) ?? null,
    shortAddress: shortAddressFromCard(card),
    ...(warmpawzAppointments
      ? { warmpawzAppointments: true as const }
      : card.priceMin != null && Number(card.priceMin) > 0
        ? { priceMin: Number(card.priceMin) }
        : {}),
    availabilityText,
    nextAvailableSlot: availabilityText,
    ...(serviceStyle ? { serviceStyle } : {}),
  };
}

export function toVendorCardDTOList(
  cards: Record<string, unknown>[],
  serviceStyle?: string,
  options?: { warmpawzAppointments?: boolean },
): VendorCardDTO[] {
  return cards.map((c) => toVendorCardDTO(c, serviceStyle, options));
}
