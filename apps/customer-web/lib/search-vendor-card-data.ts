/** Vendor row shape for /search listing cards (mapped from GET /search + WAPPT merge). */
export interface SearchVendorCardData {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  photo?: string;
  photoUrl?: string;
  roleDisplayName?: string;
  preferredServiceStyle?: string;
  serviceStyle?: string;
  isVerified?: boolean;
  nextAvailableSlot?: string;
  timing?: string;
}
