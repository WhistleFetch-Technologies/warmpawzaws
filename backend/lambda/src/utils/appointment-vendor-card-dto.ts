/**
 * Slim vendor card for Warmpawz Appointments discovery (no pricing or time fields).
 */

export type AppointmentVendorCardDTO = {
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
  serviceStyle?: string;
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

export function toAppointmentVendorCardDTO(
  card: Record<string, unknown>,
  serviceStyle?: string
): AppointmentVendorCardDTO {
  const id = String(card.vendorId ?? card.id ?? '');
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
    ...(serviceStyle ? { serviceStyle } : {}),
  };
}

export function toAppointmentVendorCardDTOList(
  cards: Record<string, unknown>[],
  serviceStyle?: string
): AppointmentVendorCardDTO[] {
  return cards.map((c) => toAppointmentVendorCardDTO(c, serviceStyle));
}
