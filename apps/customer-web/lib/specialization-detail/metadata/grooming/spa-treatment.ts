import { defineSpecialization } from '../../define';

export const spaTreatmentMetadata = defineSpecialization({
  id: 'spa_treatment',
  category: 'grooming',
  title: 'Spa Treatment',
  description:
    'A luxurious pampering session with premium bath products, deep conditioning, paw care, and calming techniques for a relaxed, refreshed pet.',
  highlightChips: ['Premium Products', 'Relaxation Focus', 'Full Pampering'],
  whatsIncluded: [
    { label: 'Aromatherapy Bath', icon: 'sparkles' },
    { label: 'Deep Conditioning', icon: 'leaf' },
    { label: 'Paw Balm Application', icon: 'heart' },
    { label: 'Facial Clean', icon: 'check' },
    { label: 'Calming Massage', icon: 'star' },
    { label: 'Finishing Cologne', icon: 'award' },
  ],
  benefits: [
    { title: 'Deep Relaxation', description: 'Calming techniques ease grooming anxiety.', icon: 'heart' },
    { title: 'Silky Coat', description: 'Conditioning restores softness and shine.', icon: 'sparkles' },
    { title: 'Paw Comfort', description: 'Balm soothes dry or cracked paw pads.', icon: 'dog' },
    { title: 'Special Treat', description: 'A indulgent experience your pet will enjoy.', icon: 'trophy' },
  ],
  whoIsThisFor: ['Anxious pets needing gentle handling', 'Special occasions and birthdays', 'Owners wanting premium coat care'],
  timeline: [
    { period: 'Welcome', title: 'Calm introduction and coat check' },
    { period: 'Spa Bath', title: 'Premium wash and deep condition' },
    { period: 'Pamper', title: 'Paw balm, facial, and massage' },
    { period: 'Finish', title: 'Dry, fluff, and gentle cologne' },
  ],
  tips: ['Request unscented products if your pet is scent-sensitive', 'Allow extra time for anxious pets to settle', 'Schedule before events or photos', 'Avoid booking right after strenuous exercise'],
});
