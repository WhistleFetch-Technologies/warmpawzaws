import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Drop-in Visits details page only. */
export const dropInVisitsMetadata = defineSpecialization({
  id: 'drop_in',
  category: 'general',
  title: 'Drop-in Visits',
  description:
    "Quick, convenient visits to your home for feeding, potty breaks, playtime and lots of love while you're away.",
  heroImage: '/images/home/Sitting/drop-in-visits-detail-hero.webp',
  heroImagePosition: 'center 42%',
  highlightChips: ['Quick & Convenient', 'Trusted Sitters', 'Happy Pets'],
  whatsIncluded: [
    { label: 'Visit duration as selected', icon: 'calendar' },
    { label: 'Feeding as per routine', icon: 'heart' },
    { label: 'Potty breaks & cleanup', icon: 'check' },
    { label: 'Playtime & companionship', icon: 'activity' },
    { label: 'Medication administration', icon: 'shield' },
    { label: 'Photo & visit updates', icon: 'sparkles' },
  ],
  whoIsThisFor: [
    'Busy workdays',
    'Short trips & errands',
    'Puppies needing breaks',
    'Senior pets & medical needs',
    'Pets who prefer staying home',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Drop-in Visit Routine',
  timeline: [
    { period: 'Check-in', title: 'Sitter arrives at your home' },
    { period: 'Feed & Hydrate', title: 'Scheduled feeding and fresh water' },
    { period: 'Potty Break & Cleanup', title: 'Potty break and tidy-up' },
    { period: 'Playtime & Engage', title: 'Active play and enrichment' },
    { period: 'Medication (if any)', title: 'Medication as instructed' },
    { period: 'Photo & Updates', title: 'Photo update for pet parents' },
    { period: 'Check-out', title: 'Visit complete and secure handover' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Visit durations: 30 min / 45 min / 60 min.',
    'Extra charges may apply for additional tasks.',
    'Schedule in advance for best availability.',
    'Provide detailed pet care instructions.',
  ],
  tips: [],
  benefits: [],
});
