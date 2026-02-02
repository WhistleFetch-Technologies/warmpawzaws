/**
 * Infer default specialization_ids from service category (and optional name).
 * Used when admin updates "Category" so specialization updates dynamically
 * without requiring manual re-selection.
 */

const CATEGORY_TO_DEFAULT_SPECS: Record<string, string[]> = {
  veterinary: ['medicine'],
  diagnostic: ['diagnostics'],
  diagnostics: ['diagnostics'],
  grooming: ['full_grooming'],
  training: ['basic_obedience'],
  walking: ['daily_walk'],
  wellness: ['medicine'],
  boarding: ['short_stay'],
  nutrition: ['diet_plan'],
  behavioral: ['separation_anxiety'],
  behaviour: ['separation_anxiety'],
  pharmacy: ['medicine'],
  emergency: ['emergency'],
  specialty: ['medicine'],
};

/** Keywords (lowercase) in service_name/display_name -> add this spec (first match can override primary) */
const KEYWORD_TO_SPEC: { keywords: string[]; spec: string }[] = [
  { keywords: ['dental', 'teeth', 'tooth', 'scaling', 'gum', 'oral'], spec: 'dentistry' },
  { keywords: ['vaccination', 'vaccine', 'booster'], spec: 'vaccination' },
  { keywords: ['surgery', 'surgical', 'spay', 'neuter', 'tumour', 'tumor', 'hernia'], spec: 'surgery' },
  { keywords: ['fracture', 'bone', 'ortho', 'joint', 'lameness', 'ligament'], spec: 'orthopedic' },
  { keywords: ['emergency', 'trauma', 'poison', 'critical care', 'seizure'], spec: 'emergency' },
  { keywords: ['skin', 'dermatology', 'allergy', 'mange', 'fungal'], spec: 'dermatology' },
  { keywords: ['heart', 'cardiac', 'ecg', 'cardiolog'], spec: 'cardiology' },
  { keywords: ['reproductive', 'pregnancy', 'antenatal', 'postnatal', 'breeding', 'progesterone'], spec: 'reproductive' },
  { keywords: ['euthanasia', 'palliative', 'grief', 'quality of life'], spec: 'palliative' },
  { keywords: ['lab', 'diagnostic', 'x-ray', 'xray', 'ultrasound', 'blood', 'cbc', 'urine', 'culture', 'fnac', 'biopsy', 'lft', 'kft', 'thyroid', 'glucose', 'electrolyte', 'coagulation', 'pancreatic', 'bile', 'crp', 'brucella', 'heartworm', 'felv', 'fiv', 'smear', 'cytology', 'histopath'], spec: 'diagnostics' },
  { keywords: ['bath', 'bathing', 'brush', 'dry'], spec: 'bath_only' },
  { keywords: ['haircut', 'styling', 'full groom'], spec: 'full_grooming' },
  { keywords: ['nail', 'trimming'], spec: 'nail_care' },
  { keywords: ['spa', 'wellness', 'luxury'], spec: 'spa_treatment' },
  { keywords: ['de-mat', 'dematting'], spec: 'full_grooming' },
  { keywords: ['de-shed', 'deshedding'], spec: 'deshedding' },
  { keywords: ['basic obedience', 'obedience'], spec: 'basic_obedience' },
  { keywords: ['potty', 'house train'], spec: 'potty_training' },
  { keywords: ['leash', 'walking'], spec: 'leash_training' },
  { keywords: ['agility', 'advanced'], spec: 'advanced_training' },
  { keywords: ['behavior modification', 'aggression', 'barking'], spec: 'aggression' },
  { keywords: ['separation anxiety', 'anxiety'], spec: 'separation_anxiety' },
  { keywords: ['fear', 'phobia'], spec: 'fear_phobia' },
  { keywords: ['destructive'], spec: 'destructive' },
  { keywords: ['resource guard'], spec: 'resource_guarding' },
  { keywords: ['30 min', '30min', 'short walk'], spec: 'daily_walk' },
  { keywords: ['60 min', '60min', 'jogging', 'long walk'], spec: 'long_walk' },
  { keywords: ['group walk', 'multiple dog'], spec: 'multiple_dogs' },
  { keywords: ['puppy walk'], spec: 'puppy_walk' },
  { keywords: ['senior walk'], spec: 'senior_walk' },
];

/**
 * Infer specialization_ids from category_id and optional service name/display name.
 * Used when admin updates Category so specialization updates dynamically.
 */
export function inferSpecializationIdsFromCategory(
  categoryId: string | null | undefined,
  serviceName?: string | null,
  displayName?: string | null
): string[] {
  const combined = [serviceName, displayName].filter(Boolean).join(' ').toLowerCase();
  const specs = new Set<string>();

  // 1) Default from category
  const normalized = (categoryId || '').toLowerCase().trim();
  const defaultSpecs = CATEGORY_TO_DEFAULT_SPECS[normalized] ?? (normalized === 'veterinary' ? ['medicine'] : []);
  defaultSpecs.forEach(s => specs.add(s));

  // 2) Refine from keywords (first matching keyword adds/refines)
  for (const { keywords, spec } of KEYWORD_TO_SPEC) {
    if (keywords.some(k => combined.includes(k))) {
      specs.add(spec);
      break; // one keyword match is enough for primary refinement
    }
  }

  return Array.from(specs);
}
