import { defineSpecialization } from '../../define';

export const dietPlanMetadata = defineSpecialization({
  id: 'diet_plan',
  aliases: ['custom_diet', 'diet_planning'],
  category: 'nutrition',
  title: 'Custom Diet Plan',
  description:
    'Personalized nutrition plans aligned to your pet\'s age, breed, activity level, and health goals—designed by certified pet nutritionists.',
  highlightChips: ['Expert Nutritionists', 'Custom Plans', 'Science-Backed'],
  whatsIncluded: [
    { label: 'Diet Assessment', icon: 'stethoscope' },
    { label: 'Meal Plan Design', icon: 'calendar' },
    { label: 'Portion Guidance', icon: 'check' },
    { label: 'Ingredient Advice', icon: 'leaf' },
    { label: 'Weight Tracking', icon: 'activity' },
    { label: 'Plan Adjustments', icon: 'heart' },
  ],
  benefits: [
    { title: 'Balanced Nutrition', description: 'Right macros for your pet\'s life stage and lifestyle.', icon: 'heart' },
    { title: 'Healthy Weight', description: 'Structured portions prevent excess gain or loss.', icon: 'activity' },
    { title: 'Shinier Coat', description: 'Quality diet shows in skin and fur health.', icon: 'sparkles' },
    { title: 'Informed Choices', description: 'Understand labels, ingredients, and portions.', icon: 'graduation' },
  ],
  whoIsThisFor: ['Picky eaters needing structure', 'Owners switching from puppy to adult food', 'Pets with general wellness goals'],
  timeline: [
    { period: 'Week 1', title: 'Assessment and baseline metrics' },
    { period: 'Week 2', title: 'Custom meal plan delivery' },
    { period: 'Week 3', title: 'Adjust portions and preferences' },
    { period: 'Week 4', title: 'Review progress and next steps' },
  ],
  tips: ['Log current food brand and daily intake', 'Weigh your pet if possible', 'Note any known allergies', 'Transition to new foods gradually over 7–10 days'],
});
