import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const reproductiveNutritionMetadata = defineSpecialization({
  id: 'reproductive',
  category: 'nutrition',
  title: 'Reproductive & Breeding',
  description:
    "Nutrition guidance for dogs and cats during breeding, pregnancy and related reproductive stages, with dietary planning adapted to the pet's individual needs.",
  heroImage: '/images/home/Nutrition/reproductive-breeding-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Reproductive Nutrition', 'Pregnancy Support', 'Breeding Diet'],
  overviewTitle: 'What is Reproductive & Breeding nutrition support?',
  overviewBody:
    'Diet planning adapted to breeding, pregnancy and related reproductive stages, with guidance tailored to the individual pet’s needs and veterinary direction.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Stage-appropriate diet guidance',
    'Calorie and nutrient planning support',
    'Feeding routine recommendations',
    'Body condition monitoring guidance',
    'Transition support between reproductive stages',
    'Coordination with veterinary guidance where appropriate',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Breeding dogs or cats needing structured nutrition support',
    'Pregnant or nursing pets requiring adapted feeding plans',
    'Pet parents planning breeding-related dietary changes',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
});
