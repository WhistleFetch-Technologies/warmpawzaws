import { sanitizeDisplayImageUrl } from './resolve-display-image-url';

/** Resolve a display-safe pet photo URL from any API / cached pet row shape. */
export function resolvePetDisplayPhotoUrl(
  pet: Record<string, unknown> | { photo?: string; image?: string; profile_photo_url?: string; profilePhoto?: string; profilePhotoUrl?: string; photo_url?: string } | null | undefined
): string | undefined {
  if (!pet) return undefined;

  const row = pet as Record<string, unknown>;
  const candidates = [
    row.photo,
    row.image,
    row.profile_photo_url,
    row.profilePhotoUrl,
    row.profilePhoto,
    row.photo_url,
  ];

  for (const candidate of candidates) {
    const url = sanitizeDisplayImageUrl(candidate);
    if (url) return url;
  }

  return undefined;
}

/** Minimal booking pet row with photo fields preserved from GET /customer/pets/:phone. */
export function mapBookingPetFromApi(p: Record<string, unknown>) {
  const photo = resolvePetDisplayPhotoUrl(p);

  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    species: String(p.species || p.type || ''),
    breed: String(p.breed ?? ''),
    type: p.type != null ? String(p.type) : undefined,
    photo,
    image: photo,
    profile_photo_url: photo,
  };
}
