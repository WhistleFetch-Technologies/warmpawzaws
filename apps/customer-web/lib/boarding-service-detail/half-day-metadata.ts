import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Half Day Boarding details page only. */
export const halfDayBoardingMetadata = defineSpecialization({
  id: 'half-day',
  category: 'boarding',
  title: 'Half Day Boarding',
  description:
    "A supervised and fun-filled half day stay for your pet with care, playtime, meals and attention while you're away for a few hours.",
  heroImage: '/images/home/Boarding/half-day-detail-hero.webp',
  heroImagePosition: 'center 42%',
  highlightChips: ['Perfect for Short Stays', 'Supervised Care', 'Play & Meals'],
  whatsIncluded: [
    { label: 'Half day supervised stay', icon: 'clock' },
    { label: 'Safe indoor/outdoor play', icon: 'activity' },
    { label: 'Feeding as per routine', icon: 'calendar' },
    { label: 'Potty breaks', icon: 'check' },
    { label: 'Fresh water always available', icon: 'heart' },
    { label: 'Play & enrichment sessions', icon: 'sparkles' },
    { label: 'Basic health monitoring', icon: 'shield' },
    { label: 'Comfortable resting area', icon: 'home' },
    { label: 'Care updates', icon: 'check' },
  ],
  whoIsThisFor: [
    'Busy work schedules',
    'Short trips & appointments',
    'Pets needing company & care for a few hours',
    'Avoiding long crate time at home',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Sample Half Day Routine',
  timeline: [
    { period: 'Check-in', title: 'Warm welcome and settling in' },
    { period: 'Settling', title: 'Calm introduction to the space' },
    { period: 'Play Time', title: 'Supervised play and activity' },
    { period: 'Meal', title: 'Scheduled feeding' },
    { period: 'Rest Time', title: 'Quiet rest period' },
    { period: 'Play & Enrichment', title: 'Enrichment and social time' },
    { period: 'Light Meal', title: 'Light snack or hydration' },
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
