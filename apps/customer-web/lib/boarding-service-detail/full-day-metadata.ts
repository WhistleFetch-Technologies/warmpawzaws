import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Full Day Boarding details page only. */
export const fullDayBoardingMetadata = defineSpecialization({
  id: 'full-day',
  category: 'boarding',
  title: 'Full Day Boarding',
  description:
    'A full-day supervised stay for your pet with meals, rest, play, and attentive care while you work or handle day-long commitments. Your pet enjoys a safe, engaging environment with trained staff until pickup.',
  heroImage: '/images/home/Boarding/full-day-detail-hero.webp',
  heroImagePosition: 'center 42%',
  highlightChips: ['All-Day Care', 'Supervised Stay', 'Meals & Play'],
  whatsIncluded: [
    { label: 'Safe indoor/outdoor activity', icon: 'activity' },
    { label: 'Fresh drinking water', icon: 'heart' },
    { label: 'Supervised rest periods', icon: 'clock' },
    { label: 'Feeding support', icon: 'calendar' },
    { label: 'Clean facilities', icon: 'sparkles' },
    { label: 'Care updates', icon: 'check' },
  ],
  whoIsThisFor: [
    'Long workdays',
    'Day-long commitments',
    'Social, friendly dogs',
    'Pets needing daytime supervision',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Typical Day',
  timeline: [
    { period: 'Check-in', title: 'Warm welcome and settling in' },
    { period: 'Settling', title: 'Calm introduction to the space' },
    { period: 'Activity', title: 'Morning play and enrichment' },
    { period: 'Meal', title: 'Scheduled feeding and hydration' },
    { period: 'Rest', title: 'Quiet rest between activities' },
    { period: 'Play', title: 'Supervised play and enrichment' },
    { period: 'Final Care', title: 'Evening check and comfort' },
    { period: 'Check-out', title: 'Happy reunion at pickup' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Exact activity schedules vary by facility',
    'Share feeding instructions and allergies at check-in',
    'Vaccination records may be required',
    'Trial a shorter visit first if your pet is anxious',
    'Pickup times should be confirmed with the facility',
  ],
  tips: [],
  benefits: [],
});

export const FULL_DAY_INCLUDED_LABELS = fullDayBoardingMetadata.whatsIncluded.map((item) => item.label);
