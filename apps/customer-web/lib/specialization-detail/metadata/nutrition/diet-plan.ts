import { defineSpecialization } from '../../define';
import { nutritionFeatures } from './nutrition-content-helpers';

export const dietPlanMetadata = defineSpecialization({
  id: 'diet_plan',
  category: 'nutrition',
  title: 'Custom Diet Plans',
  description:
    "Personalised nutrition planning based on your pet's age, breed, lifestyle, health needs, body condition and dietary preferences.",
  heroImage: '/images/home/Nutrition/custom-diet-plans-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Personalised Diet', 'Lifestyle Based', 'Nutrition Planning'],
  overviewTitle: 'What are Custom Diet Plans?',
  overviewBody:
    'Personalised nutrition planning tailored to your pet’s age, breed, lifestyle, health needs, body condition and dietary preferences.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: nutritionFeatures([
    'Diet assessment and review',
    'Personalised meal planning guidance',
    'Portion and feeding routine recommendations',
    'Ingredient and food choice guidance',
    'Body condition and lifestyle considerations',
    'Plan adjustments as needs change',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Pet parents seeking a structured, personalised feeding plan',
    'Pets with specific lifestyle or body condition goals',
    'Households transitioning to a new diet or routine',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
});
