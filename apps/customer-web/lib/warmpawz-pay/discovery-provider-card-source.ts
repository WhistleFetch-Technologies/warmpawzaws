/** Minimal discovery list fields for WarmpawzPayVendorCard mappers — service-agnostic. */
export type DiscoveryProviderCardSource = {
  name: string;
  photo?: string;
  isVerified?: boolean;
  rating: string | number;
  reviewCount: number;
  distance?: number | null;
  distanceText?: string | null;
  nextAvailableSlot?: string;
  availabilityText?: string;
  experienceYears?: number;
  providerType?: 'vendor' | 'staff' | 'individual';
  city?: string;
};
