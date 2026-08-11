import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const allergiesMetadata = defineSpecialization({
  id: 'allergies',
  category: 'nutrition',
  title: 'Allergy Diet',
  description:
    'Dietary guidance for pets with suspected or diagnosed food sensitivities, helping identify suitable food choices and structured feeding approaches under appropriate veterinary guidance.',
  heroImage: '/images/home/Nutrition/allergy-diet-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Food Sensitivity', 'Elimination Diet', 'Diet Guidance'],
  overviewTitle: 'What is an Allergy Diet?',
  overviewBody:
    'Dietary guidance for pets with suspected or diagnosed food sensitivities, helping identify suitable food choices and structured feeding approaches under appropriate veterinary guidance.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Food sensitivity history review',
    'Structured feeding approach guidance',
    'Suitable food choice recommendations',
    'Elimination diet planning support',
    'Ingredient and treat guidance',
    'Monitoring support during dietary changes',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Pets with suspected food sensitivities',
    'Pets undergoing dietary trials with veterinary guidance',
    'Pet parents seeking structured allergy-focused feeding support',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  importantNotesTitle: 'Important',
  importantNotes: [
    'Dietary guidance supports feeding decisions under appropriate veterinary guidance. A diet plan alone does not diagnose or cure allergies.',
  ],
});
