import { resolveSpecializationHeroImage } from '@/lib/specialization-hub-image-registry';
import type { SpecializationDetailContent, SpecializationDetailDefinition } from './types';

export function defineSpecialization(
  definition: SpecializationDetailDefinition,
): SpecializationDetailContent {
  const category = definition.category ?? 'general';
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    heroImage:
      definition.heroImage ?? resolveSpecializationHeroImage(definition.id, category),
    highlightChips: definition.highlightChips,
    whatsIncluded: definition.whatsIncluded,
    benefits: definition.benefits,
    whoIsThisFor: definition.whoIsThisFor,
    timeline: definition.timeline,
    tips: definition.tips,
  };
}
