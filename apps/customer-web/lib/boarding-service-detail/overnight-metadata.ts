import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Overnight Boarding details page only. */
export const overnightBoardingMetadata = defineSpecialization({
  id: 'overnight',
  category: 'boarding',
  title: 'Overnight Boarding',
  description:
    "A safe, comfortable and supervised overnight stay for your pet with meals, potty breaks, playtime and all the care they need while you're away.",
  heroImage: '/images/home/Boarding/overnight-detail-hero.webp',
  heroImagePosition: 'center 45%',
  highlightChips: ['Peaceful Sleep', '24×7 Supervision', 'Meals & Care'],
  whatsIncluded: [
    { label: 'Comfortable overnight stay', icon: 'home' },
    { label: '24×7 supervision', icon: 'shield' },
    { label: 'Feeding as per routine', icon: 'calendar' },
    { label: 'Regular potty breaks', icon: 'activity' },
    { label: 'Fresh water always available', icon: 'heart' },
    { label: 'Play & enrichment sessions', icon: 'sparkles' },
    { label: 'Cozy bedding', icon: 'check' },
    { label: 'Basic health monitoring', icon: 'heart' },
    { label: 'Care updates', icon: 'check' },
  ],
  whoIsThisFor: [
    'Pet parents traveling overnight',
    'Busy schedules & late returns',
    'Pets needing company & care at night',
    "Safe stay while you're away",
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Sample Daily Routine',
  timeline: [
    { period: 'Evening Check-in', title: 'Warm welcome and settling in' },
    { period: 'Dinner', title: 'Scheduled evening meal' },
    { period: 'Potty Break', title: 'Outdoor relief break' },
    { period: 'Play Time', title: 'Evening enrichment' },
    { period: 'Cozy Bedtime', title: 'Comfortable rest' },
    { period: 'Overnight Care', title: 'Supervised overnight monitoring' },
    { period: 'Morning Potty Break', title: 'Morning relief break' },
    { period: 'Breakfast', title: 'Morning meal' },
    { period: 'Check-out', title: 'Pickup and handover' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Exact activity schedules vary by facility.',
    "Meal instructions should follow the pet's routine.",
    'Pickup/check-out timing depends on the facility.',
    'Facility-specific health, vaccination and behavior requirements may apply.',
    'Pets may be grouped separately based on temperament, size and facility policy.',
  ],
  tips: [],
  benefits: [],
});
