const VET_IMG = '/images/home/Vet';

const VET_HEADER_BANNER = `${VET_IMG}/banner-dog-and-cat.webp`;

/** Mirrors VET_PROBLEM_PET_IMAGES order in vet-hub-assets.ts — same paths, no lucide import. */
const VET_PROBLEM_PET_IMAGES = [
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-cat2.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-cat5.webp`,
  `${VET_IMG}/card-dog6.webp`,
  `${VET_IMG}/card-dog1.webp`,
  `${VET_IMG}/card-dog3.webp`,
  `${VET_IMG}/card-dog2.webp`,
  `${VET_IMG}/card-cat1.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-dog4.webp`,
  `${VET_IMG}/card-cat3.webp`,
];

const VET_SPECIALIZATION_IMAGES: Record<string, string> = {
  lab_diagnostics: `${VET_IMG}/lab.webp`,
  medicine: `${VET_IMG}/medicine.webp`,
};

const VET_PROBLEM_ORDER = [
  'lab_diagnostics',
  'palliative',
  'reproductive',
  'medicine',
  'vaccination',
  'dermatology',
  'dentistry',
  'ophthalmology',
  'cardiology',
  'surgery',
  'emergency',
  'orthopedics',
  'neurology',
];

/** Reuses existing Vet hub asset paths only — no invented paths. */
export function resolveVetHeroImage(id: string): string {
  const key = id.toLowerCase();
  const dedicated = VET_SPECIALIZATION_IMAGES[key];
  if (dedicated) return dedicated;

  const idx = VET_PROBLEM_ORDER.indexOf(key);
  if (idx >= 0 && VET_PROBLEM_PET_IMAGES[idx]) {
    return VET_PROBLEM_PET_IMAGES[idx];
  }

  return VET_HEADER_BANNER;
}
