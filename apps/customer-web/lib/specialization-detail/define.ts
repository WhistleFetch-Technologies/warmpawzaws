import { resolveSpecializationHeroImage } from '@/lib/specialization-hub-image-registry';
import type { SpecializationDetailDefinition, StandardSpecializationDetailContent } from './types';

export function defineSpecialization(
  definition: SpecializationDetailDefinition,
): StandardSpecializationDetailContent {
  const category = definition.category ?? 'general';
  return {
    layout: 'standard',
    id: definition.id,
    title: definition.title,
    description: definition.description,
    heroImage:
      definition.heroImage ?? resolveSpecializationHeroImage(definition.id, category),
    heroImagePosition: definition.heroImagePosition,
    highlightChips: definition.highlightChips,
    overviewTitle: definition.overviewTitle,
    overviewBody: definition.overviewBody,
    whatYouLearn: definition.whatYouLearn,
    whatYouLearnTitle: definition.whatYouLearnTitle,
    whatsIncluded: definition.whatsIncluded,
    whatsIncludedTitle: definition.whatsIncludedTitle,
    trainerDelivers: definition.trainerDelivers,
    trainerDeliversTitle: definition.trainerDeliversTitle,
    behavioursAddressed: definition.behavioursAddressed,
    behavioursAddressedTitle: definition.behavioursAddressedTitle,
    benefits: definition.benefits,
    whoIsThisFor: definition.whoIsThisFor,
    audienceTitle: definition.audienceTitle,
    timeline: definition.timeline,
    timelineTitle: definition.timelineTitle,
    tips: definition.tips,
    notIncluded: definition.notIncluded,
    notIncludedTitle: definition.notIncludedTitle,
    notIncludedFooter: definition.notIncludedFooter,
    importantNotes: definition.importantNotes,
    importantNotesTitle: definition.importantNotesTitle,
    serviceModeInformation: definition.serviceModeInformation,
  };
}
