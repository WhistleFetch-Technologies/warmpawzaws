import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const palliativeNutritionMetadata = defineSpecialization({
  id: 'palliative',
  category: 'nutrition',
  title: 'Palliative & End-of-Life Care',
  description:
    'Gentle nutrition guidance designed to support comfort, appetite, hydration and overall wellbeing for pets with advanced or life-limiting health conditions.',
  heroImage: '/images/home/Nutrition/palliative-end-of-life-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Comfort Nutrition', 'Appetite Support', 'Gentle Care'],
  overviewTitle: 'What is Palliative & End-of-Life nutrition support?',
  overviewBody:
    'Supportive feeding guidance focused on comfort, palatability, hydration and maintaining quality of life for pets with advanced or life-limiting conditions.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Gentle feeding guidance',
    'Appetite and intake support strategies',
    'Hydration-aware nutrition planning',
    'Comfort-focused meal suggestions',
    'Flexible feeding routines',
    'Support for changing daily needs',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Pets with advanced or life-limiting health conditions',
    'Pets with reduced appetite or changing eating patterns',
    'Pet parents seeking gentle, comfort-focused nutrition support',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  importantNotesTitle: 'Important',
  importantNotes: [
    'This service provides nutrition guidance to support comfort and wellbeing. It does not replace veterinary treatment, pain management, or end-of-life medical care.',
  ],
});
