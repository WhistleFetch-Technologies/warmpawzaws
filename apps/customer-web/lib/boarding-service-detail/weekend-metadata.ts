import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Weekend Boarding details page only. */
export const weekendBoardingMetadata = defineSpecialization({
  id: 'weekend',
  category: 'boarding',
  title: 'Weekend Boarding',
  description:
    "A comfortable and supervised weekend stay for your pet with care, playtime, meals and all the love they need while you're away.",
  heroImage: '/images/home/Boarding/weekend-detail-hero.webp',
  heroImagePosition: 'center 42%',
  highlightChips: ['Perfect for Weekends', 'Safe & Supervised', 'Meals & Play'],
  whatsIncluded: [
    { label: 'Supervised weekend stay', icon: 'calendar' },
    { label: 'Safe indoor/outdoor play', icon: 'activity' },
    { label: 'Feeding as per routine', icon: 'heart' },
    { label: 'Regular potty breaks', icon: 'check' },
    { label: 'Fresh water always available', icon: 'heart' },
    { label: 'Cozy bedding', icon: 'home' },
    { label: 'Play & enrichment sessions', icon: 'sparkles' },
    { label: 'Basic health monitoring', icon: 'shield' },
    { label: 'Care updates', icon: 'check' },
    { label: 'Lots of love & attention', icon: 'heart' },
  ],
  whoIsThisFor: [
    'Pet parents on weekend getaways',
    'Short vacations & outstation trips',
    'Pets needing company & care through the weekend',
    'Avoiding long crate time at home',
    'Dogs who love social time',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Weekend Routine',
  timeline: [
    { period: 'Check-in & Settle', title: 'Warm welcome and settling in' },
    { period: 'Play & Social Time', title: 'Supervised social play' },
    { period: 'Meal Time', title: 'Scheduled feeding' },
    { period: 'Rest & Relax', title: 'Quiet rest period' },
    { period: 'Enrichment Activities', title: 'Mental and physical enrichment' },
    { period: 'Evening Play', title: 'Evening activity session' },
    { period: 'Good Night Care', title: 'Comfortable overnight care' },
    { period: 'Next Day Check-out', title: 'Pickup and handover' },
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
