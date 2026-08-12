import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const seniorNutritionMetadata = defineSpecialization({
  id: 'senior_nutrition',
  category: 'nutrition',
  title: 'Senior Pet Nutrition',
  description:
    'Nutrition guidance for ageing pets focused on maintaining healthy body condition, supporting everyday wellbeing and adapting the diet to changing age-related needs.',
  heroImage: '/images/home/Nutrition/senior-pet-nutrition-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Senior Nutrition', 'Healthy Ageing', 'Diet Support'],
  overviewTitle: 'What is Senior Pet Nutrition?',
  overviewBody:
    'Nutrition guidance for ageing pets focused on maintaining healthy body condition, supporting everyday wellbeing and adapting the diet to changing age-related needs.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Age-appropriate diet guidance',
    'Body condition and appetite support',
    'Feeding routine recommendations',
    'Digestibility and palatability considerations',
    'Monitoring support for changing senior needs',
    'Plan adjustments as pets age',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Ageing dogs and cats',
    'Senior pets with changing appetite or activity',
    'Pet parents adapting diet to age-related needs',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
});
