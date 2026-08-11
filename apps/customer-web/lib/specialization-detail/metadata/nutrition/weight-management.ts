import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const weightManagementMetadata = defineSpecialization({
  id: 'weight_management',
  category: 'nutrition',
  title: 'Weight Management',
  description:
    'Nutrition planning designed to help pets maintain a healthy body condition through appropriate calorie intake, feeding routines and lifestyle-aware dietary guidance.',
  heroImage: '/images/home/Nutrition/weight-management-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Healthy Weight', 'Portion Guidance', 'Diet Planning'],
  overviewTitle: 'What is Weight Management?',
  overviewBody:
    'Nutrition planning designed to help pets maintain a healthy body condition through appropriate calorie intake, feeding routines and lifestyle-aware dietary guidance.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Body condition assessment support',
    'Calorie and portion guidance',
    'Structured feeding routine planning',
    'Treat and snack planning guidance',
    'Progress monitoring support',
    'Lifestyle-aware diet adjustments',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Overweight or underweight pets',
    'Pets needing structured portion control',
    'Pet parents working toward a healthy body condition',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
});
