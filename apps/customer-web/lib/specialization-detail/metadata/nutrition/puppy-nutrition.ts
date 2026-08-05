import { defineSpecialization } from '../../define';

export const puppyNutritionMetadata = defineSpecialization({
  id: 'puppy_nutrition',
  aliases: ['puppy_diet'],
  category: 'nutrition',
  title: 'Puppy Nutrition',
  description:
    'Growth-focused feeding plans for puppies with correct calcium, protein, and calorie balance to support healthy development and bone formation.',
  highlightChips: ['Growth Support', 'Breed-Sized Portions', 'Development Focus'],
  whatsIncluded: [
    { label: 'Growth Stage Assessment', icon: 'dog' },
    { label: 'Puppy Meal Schedule', icon: 'calendar' },
    { label: 'Breed-Size Portions', icon: 'check' },
    { label: 'Calcium Balance Guidance', icon: 'heart' },
    { label: 'Treat & Snack Limits', icon: 'leaf' },
    { label: 'Transition Planning', icon: 'graduation' },
  ],
  benefits: [
    { title: 'Healthy Growth', description: 'Nutrients matched to rapid puppy development.', icon: 'activity' },
    { title: 'Strong Bones', description: 'Balanced calcium prevents skeletal issues.', icon: 'shield' },
    { title: 'Stable Energy', description: 'Frequent small meals fuel active puppies.', icon: 'zap' },
    { title: 'Smooth Transitions', description: 'Plan for switching to adult food later.', icon: 'calendar' },
  ],
  whoIsThisFor: ['New puppy owners', 'Large-breed puppy growth management', 'Rescue pups with unknown history'],
  timeline: [
    { period: 'Week 1', title: 'Age, breed, and current diet review' },
    { period: 'Week 2', title: 'Puppy feeding schedule created' },
    { period: 'Week 3', title: 'Portion tweaks as puppy grows' },
    { period: 'Month 2+', title: 'Growth milestone check-ins' },
  ],
  tips: ['Feed puppy-specific food, not adult formulas', 'Large breeds need controlled growth diets', 'Avoid over-supplementing calcium', 'Weigh weekly during rapid growth phases'],
});
