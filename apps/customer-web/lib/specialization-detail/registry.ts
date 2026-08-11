import type { SpecializationDetailContent } from './types';
import { isVetSpecializationDetail } from './types';
import * as training from './metadata/training';
import * as behavior from './metadata/behavior';
import * as walking from './metadata/walking';
import * as grooming from './metadata/grooming';
import * as boarding from './metadata/boarding';
import * as vet from './metadata/vet';
import * as nutrition from './metadata/nutrition';

const ALL_METADATA: SpecializationDetailContent[] = [
  ...Object.values(training),
  ...Object.values(behavior),
  ...Object.values(walking),
  ...Object.values(grooming),
  ...Object.values(boarding),
  ...Object.values(vet),
  ...Object.values(nutrition),
];

/** Canonical id → alias keys (lowercase lookup). */
const ALIASES_BY_ID: Record<string, string[]> = {
  house_training: ['potty_training'],
  leash_walking: ['leash_training'],
  advanced_training: ['advanced_skills'],
  aggression: ['aggression_fix', 'agression_fix'],
  separation_anxiety: ['separation'],
  excessive_barking: ['barking'],
  fear_phobia: ['fear_n_phobia'],
  destructive: ['destructive_behavior', 'destructive_behaviour'],
  resource_guarding: ['possessive_behavior', 'possessive_behaviour'],
  long_walk: ['adventure_walk'],
  short_stay: ['weekend_stay'],
  medicine: ['general', 'general_consultation'],
  lab_diagnostics: ['lab-diagnostics', 'diagnostics', 'lab'],
  orthopedics: ['orthopedic', 'bone-joint', 'bone_joint'],
  diet_plan: ['custom_diet', 'diet_planning'],
  puppy_nutrition: ['puppy_diet'],
  senior_nutrition: ['senior_diet'],
  weight_management: ['weight_loss', 'weight_measurement'],
  allergies: ['allergy_diet', 'food_allergies'],
  special_diet: ['prescription_diet', 'medical_diet'],
};

/** Nutrition hub ids that share canonical ids with vet specializations. */
const NUTRITION_VET_OVERLAP_IDS = new Set(['lab_diagnostics', 'palliative', 'reproductive']);

/** Nutrition hub aliases stored under nutrition: prefix to avoid vet lookup collisions. */
const NUTRITION_OVERLAP_ALIASES: Record<string, string[]> = {
  lab_diagnostics: ['lab_diagnosis', 'lab_diagonosis'],
  reproductive: ['productive', 'breeding'],
};

export type SpecializationLookupContext = {
  category?: string;
};

function normalizeLookupCategory(category?: string): string | undefined {
  const value = category?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'nutrition' || value === 'nutritionist' || value === 'pet_nutritionist' || value === 'wellness') {
    return 'nutrition';
  }
  return value;
}

function buildRegistry(): Map<string, SpecializationDetailContent> {
  const map = new Map<string, SpecializationDetailContent>();

  for (const content of ALL_METADATA) {
    const id = content.id.toLowerCase();
    if (NUTRITION_VET_OVERLAP_IDS.has(content.id) && !isVetSpecializationDetail(content)) {
      map.set(`nutrition:${id}`, content);
      continue;
    }
    map.set(id, content);
  }

  for (const content of ALL_METADATA) {
    if (NUTRITION_VET_OVERLAP_IDS.has(content.id) && !isVetSpecializationDetail(content)) {
      continue;
    }
    for (const alias of ALIASES_BY_ID[content.id] ?? []) {
      map.set(alias.toLowerCase(), content);
    }
  }

  for (const [id, aliases] of Object.entries(NUTRITION_OVERLAP_ALIASES)) {
    const nutritionContent = map.get(`nutrition:${id}`);
    if (!nutritionContent) continue;
    for (const alias of aliases) {
      map.set(`nutrition:${alias.toLowerCase()}`, nutritionContent);
    }
  }

  return map;
}

export const SPECIALIZATION_REGISTRY = buildRegistry();

export function getSpecializationDetail(
  id: string,
  context?: SpecializationLookupContext,
): SpecializationDetailContent | undefined {
  const key = id.trim().toLowerCase();
  const category = normalizeLookupCategory(context?.category);

  if (category === 'nutrition') {
    return (
      SPECIALIZATION_REGISTRY.get(`nutrition:${key}`) ??
      SPECIALIZATION_REGISTRY.get(key)
    );
  }

  return SPECIALIZATION_REGISTRY.get(key);
}
