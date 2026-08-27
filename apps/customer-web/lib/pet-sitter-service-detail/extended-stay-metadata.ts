import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Extended Stay details page only. */
export const extendedStayMetadata = defineSpecialization({
  id: 'extended_home',
  category: 'general',
  title: 'Extended Stay',
  description:
    "Multi-day in-home care for your pet with consistent routine, companionship and lots of love while you're away.",
  heroImage: '/images/home/Sitting/extended-stay-detail-hero.webp',
  heroImagePosition: 'center 45%',
  highlightChips: ['Ideal for Long Stays', 'Trusted & Verified', 'Daily Updates'],
  whatsIncluded: [
    { label: 'Live-in care at your home', icon: 'home' },
    { label: 'Feeding as per routine', icon: 'heart' },
    { label: 'Daily activities & playtime', icon: 'activity' },
    { label: 'Potty breaks & hygiene', icon: 'check' },
    { label: 'Medication administration', icon: 'shield' },
    { label: 'Home security & care', icon: 'shield' },
    { label: 'Photo & video updates', icon: 'sparkles' },
  ],
  whoIsThisFor: [
    'Vacations & long trips',
    'International travel',
    'Pets with anxiety',
    'Senior pets & special needs',
    'Avoiding kennels & relocation',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Extended Stay Routine (Daily)',
  timeline: [
    { period: 'Morning Walk', title: 'Start the day with a walk' },
    { period: 'Breakfast', title: 'Scheduled morning feeding' },
    { period: 'Play & Enrichment', title: 'Active play and mental enrichment' },
    { period: 'Relax & Nap', title: 'Quiet rest period' },
    { period: 'Evening Walk', title: 'Evening walk and potty break' },
    { period: 'Dinner', title: 'Evening feeding' },
    { period: 'Night Care', title: 'Comfortable overnight care at home' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Minimum stay requirements may apply.',
    'Extra charges for extended duration may apply.',
    'Advance booking recommended.',
    'Provide detailed pet care instructions.',
  ],
  tips: [],
  benefits: [],
});
