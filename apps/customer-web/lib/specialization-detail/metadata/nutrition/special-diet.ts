import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const specialDietMetadata = defineSpecialization({
  id: 'special_diet',
  category: 'nutrition',
  title: 'Prescription Diet',
  description:
    'Veterinary-guided nutrition support for pets whose health conditions require a specific therapeutic or prescription diet as part of their overall care plan.',
  heroImage: '/images/home/Nutrition/prescription-diet-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Therapeutic Nutrition', 'Vet Guided', 'Specialised Diet'],
  overviewTitle: 'What is a Prescription Diet?',
  overviewBody:
    'Veterinary-guided nutrition support for pets whose health conditions require a specific therapeutic or prescription diet as part of their overall care plan.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Therapeutic diet planning support',
    'Feeding routine guidance',
    'Transition and compliance support',
    'Coordination with veterinary care plans',
    'Monitoring support for ongoing needs',
    'Adjustments aligned with veterinary guidance',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Pets on or needing a therapeutic diet under veterinary guidance',
    'Pet parents managing condition-specific feeding plans',
    'Households transitioning to a prescription diet',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  importantNotesTitle: 'Important',
  importantNotes: [
    'Prescription and therapeutic diets should be selected and used under veterinary guidance as part of your pet’s overall care plan.',
  ],
});
