import { defineSpecialization } from '../../define';

export const bathOnlyMetadata = defineSpecialization({
  id: 'bath_only',
  category: 'grooming',
  title: 'Bath Only',
  description:
    'A refreshing bath and brush using pet-safe products to remove dirt, reduce odour, and keep your pet\'s coat clean between full grooms.',
  highlightChips: ['Gentle Products', 'Coat Care', 'Stress-Free Bath'],
  whatsIncluded: [
    { label: 'Warm Bath', icon: 'sparkles' },
    { label: 'Coat Brushing', icon: 'check' },
    { label: 'Ear Check', icon: 'heart' },
    { label: 'Towel Dry', icon: 'home' },
    { label: 'Nail Buff (if needed)', icon: 'star' },
    { label: 'Finishing Spritz', icon: 'leaf' },
  ],
  benefits: [
    { title: 'Cleaner Coat', description: 'Removes dirt, mud, and everyday odour.', icon: 'sparkles' },
    { title: 'Healthier Skin', description: 'Suited shampoo reduces irritation and dryness.', icon: 'heart' },
    { title: 'Less Shedding', description: 'Brush-out removes loose fur before it spreads.', icon: 'check' },
    { title: 'Fresh Home', description: 'Cuddles feel nicer for everyone after a bath.', icon: 'home' },
  ],
  whoIsThisFor: ['Regular coat maintenance', 'Between full grooming appointments', 'Pets with sensitive skin'],
  timeline: [
    { period: 'Step 1', title: 'Coat assessment and brush-out' },
    { period: 'Step 2', title: 'Gentle bath with suited shampoo' },
    { period: 'Step 3', title: 'Dry and final brush' },
    { period: 'After', title: 'Home care tips for maintenance' },
  ],
  tips: ['Brush before the appointment if heavily matted', 'Share any skin allergies or sensitivities', 'Allow drying time at home', 'Book before heavy shedding season'],
});
