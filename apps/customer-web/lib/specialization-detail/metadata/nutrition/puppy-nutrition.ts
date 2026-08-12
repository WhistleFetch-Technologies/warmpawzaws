import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const puppyNutritionMetadata = defineSpecialization({
  id: 'puppy_nutrition',
  category: 'nutrition',
  title: 'Puppy Nutrition',
  description:
    'Age-appropriate nutrition guidance to support healthy growth, development, energy needs and everyday wellbeing during puppyhood.',
  heroImage: '/images/home/Nutrition/puppy-nutrition-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Growth Support', 'Puppy Diet', 'Balanced Nutrition'],
  overviewTitle: 'What is Puppy Nutrition?',
  overviewBody:
    'Age-appropriate nutrition guidance to support healthy growth, development, energy needs and everyday wellbeing during puppyhood.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Growth-stage nutrition guidance',
    'Feeding schedule recommendations',
    'Portion guidance for puppies',
    'Balanced nutrient planning support',
    'Transition guidance as puppies grow',
    'Everyday feeding routine support',
  ]),
  benefits: [],
  whoIsThisFor: [
    'New puppy owners',
    'Puppies needing structured feeding guidance',
    'Pet parents planning healthy puppyhood nutrition',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
});
