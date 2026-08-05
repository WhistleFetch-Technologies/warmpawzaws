import type { SpecializationDetailContent } from './types';
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
  diet_plan: ['custom_diet', 'diet_planning'],
  puppy_nutrition: ['puppy_diet'],
  senior_nutrition: ['senior_diet'],
  weight_management: ['weight_loss', 'weight_measurement'],
  allergies: ['allergy_diet', 'food_allergies'],
  special_diet: ['prescription_diet', 'medical_diet'],
};

function buildRegistry(): Map<string, SpecializationDetailContent> {
  const map = new Map<string, SpecializationDetailContent>();

  for (const content of ALL_METADATA) {
    map.set(content.id.toLowerCase(), content);
    for (const alias of ALIASES_BY_ID[content.id] ?? []) {
      map.set(alias.toLowerCase(), content);
    }
  }

  return map;
}

export const SPECIALIZATION_REGISTRY = buildRegistry();

export function getSpecializationDetail(id: string): SpecializationDetailContent | undefined {
  return SPECIALIZATION_REGISTRY.get(id.trim().toLowerCase());
}
