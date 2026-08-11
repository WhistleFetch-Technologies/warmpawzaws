import { defineSpecialization } from '../../define';

export const longStayMetadata = defineSpecialization({
  id: 'long_stay',
  category: 'boarding',
  title: 'Extended Stay',
  description:
    'Multi-day boarding for longer vacations with consistent routines, daily enrichment, and attentive care that keeps your pet comfortable throughout.',
  highlightChips: ['Long-Term Care', 'Daily Enrichment', 'Consistent Routine'],
  whatsIncluded: [
    { label: 'Extended Accommodation', icon: 'home' },
    { label: 'Daily Exercise', icon: 'activity' },
    { label: 'Personalized Feeding', icon: 'calendar' },
    { label: 'Enrichment Activities', icon: 'dog' },
    { label: 'Regular Health Checks', icon: 'heart' },
    { label: 'Owner Updates', icon: 'check' },
  ],
  benefits: [
    { title: 'Stable Routine', description: 'Consistent meals, rest, and play over many days.', icon: 'calendar' },
    { title: 'Less Separation Stress', description: 'Familiar staff and surroundings build comfort.', icon: 'heart' },
    { title: 'Vacation Peace of Mind', description: 'Focus on your trip knowing your pet is cared for.', icon: 'shield' },
    { title: 'Social Engagement', description: 'Supervised play and interaction where suitable.', icon: 'users' },
  ],
  whoIsThisFor: ['Extended vacation travellers', 'Relocation transitions', 'Long work assignments abroad'],
  timeline: [
    { period: 'Day 1', title: 'Check-in and acclimation period' },
    { period: 'Daily', title: 'Meals, exercise, and enrichment' },
    { period: 'Mid-stay', title: 'Routine established and monitored' },
    { period: 'Pickup', title: 'Happy reunion and care summary' },
  ],
  tips: ['Provide enough food or confirm facility supplies', 'Leave emergency vet contact details', 'Share any behavioural quirks upfront', 'Consider a pre-stay trial night'],
});
