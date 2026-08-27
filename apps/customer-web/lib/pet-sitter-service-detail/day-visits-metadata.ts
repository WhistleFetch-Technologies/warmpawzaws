import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Day Visits details page only. */
export const dayVisitsMetadata = defineSpecialization({
  id: 'day_visits',
  category: 'general',
  title: 'Day Visits',
  description:
    "Scheduled daytime visits to keep your pet active, fed and happy while you're at work or away for a few hours.",
  heroImage: '/images/home/Sitting/day-visits-detail-hero.webp',
  heroImagePosition: 'center 42%',
  highlightChips: ['Scheduled Visits', 'Trusted Sitters', 'Happy Pets'],
  whatsIncluded: [
    { label: 'Visit duration as selected', icon: 'calendar' },
    { label: 'Feeding as per routine', icon: 'heart' },
    { label: 'Potty breaks & cleanup', icon: 'check' },
    { label: 'Playtime & companionship', icon: 'activity' },
    { label: 'Medication administration', icon: 'shield' },
    { label: 'Photo & visit updates', icon: 'sparkles' },
  ],
  whoIsThisFor: [
    'Long work hours',
    'Short trips & errands',
    'Puppies needing attention',
    'Senior pets & special needs',
    'Pets who prefer home comfort',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Day Visit Routine',
  timeline: [
    { period: 'Check-in', title: 'Sitter arrives at your home' },
    { period: 'Potty Break', title: 'Walk and potty break' },
    { period: 'Feed & Hydrate', title: 'Scheduled feeding and fresh water' },
    { period: 'Play & Engage', title: 'Active play and enrichment' },
    { period: 'Cleanup & Care', title: 'Tidy-up and pet care' },
    { period: 'Update & Check-out', title: 'Photo update and handover' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Visit durations: 30 min / 45 min / 60 min.',
    'Timings may vary by sitter availability.',
    'Additional charges may apply for holidays or last-minute bookings.',
    'Keep home access & pet instructions ready.',
  ],
  tips: [],
  benefits: [],
});
