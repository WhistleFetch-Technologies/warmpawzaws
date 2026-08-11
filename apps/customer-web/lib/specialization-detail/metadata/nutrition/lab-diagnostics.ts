import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const labDiagnosticsNutritionMetadata = defineSpecialization({
  id: 'lab_diagnostics',
  category: 'nutrition',
  title: 'Lab & Diagnostics',
  description:
    "Nutrition-focused diagnostic support to understand your pet's health, nutritional status and dietary needs through appropriate veterinary assessments and laboratory guidance.",
  heroImage: '/images/home/Nutrition/lab-diagnostics-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Nutritional Assessment', 'Lab Support', 'Health Monitoring'],
  overviewTitle: 'What is Lab & Diagnostics support?',
  overviewBody:
    'Nutrition guidance that uses appropriate veterinary assessments and laboratory information to help understand your pet’s health status and how diet may support their care plan.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Nutritional status review',
    'Diet-related health assessment support',
    'Guidance on relevant laboratory information',
    'Feeding recommendations aligned with health findings',
    'Monitoring support for ongoing nutritional needs',
    'Coordination with veterinary guidance where appropriate',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Pets needing nutrition guidance alongside health monitoring',
    'Pets with changing appetite, weight, or body condition',
    'Pet parents seeking diet support informed by health assessments',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  importantNotesTitle: 'Important',
  importantNotes: [
    'This specialization supports nutrition planning informed by veterinary assessments. It is not a standalone laboratory service unless your chosen provider and booking mode specifically offer that.',
  ],
});
