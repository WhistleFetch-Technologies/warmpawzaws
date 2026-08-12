import { resolveVetHeroImage } from './metadata/vet/vet-hero-images';
import type { VetSpecializationDetailContent, VetSpecializationDetailDefinition } from './types';

export function defineVetSpecialization(
  definition: VetSpecializationDetailDefinition,
): VetSpecializationDetailContent {
  return {
    layout: 'vet',
    id: definition.id,
    title: definition.title,
    description: definition.description,
    heroImage: definition.heroImage ?? resolveVetHeroImage(definition.id),
    heroImagePosition: definition.heroImagePosition,
    highlightChips: definition.highlightChips,
    sections: definition.sections,
    serviceModeInformation: definition.serviceModeInformation,
    visualVariant: definition.visualVariant ?? 'default',
  };
}
