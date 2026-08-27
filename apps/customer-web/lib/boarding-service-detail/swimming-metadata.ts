import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Pet Swimming details page only. */
export const swimmingMetadata = defineSpecialization({
  id: 'swimming',
  category: 'boarding',
  title: 'Swimming',
  description:
    'A refreshing and fun swimming session for your pet that helps improve fitness, relieves stress and keeps them happy & healthy.',
  heroImage: '/images/home/Boarding/swimming-detail-hero.webp',
  heroImagePosition: 'center 40%',
  highlightChips: ['Cool & Refreshing', 'Safe & Supervised', 'Healthy & Fun'],
  whatsIncluded: [
    { label: 'Supervised swimming session', icon: 'activity' },
    { label: 'Life jacket for safety', icon: 'shield' },
    { label: 'Pre & post swim rinse', icon: 'sparkles' },
    { label: 'Towel dry', icon: 'check' },
    { label: 'Playtime after swim', icon: 'heart' },
    { label: 'Clean & hygienic pool', icon: 'sparkles' },
    { label: 'Temperature controlled water', icon: 'sun' },
    { label: 'Breaks as needed', icon: 'clock' },
    { label: 'Care updates', icon: 'check' },
  ],
  whoIsThisFor: [
    'High energy dogs',
    'Overweight pets',
    'Joint & muscle support',
    'Stress relief & mental stimulation',
    'Dogs who love water fun',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Swimming Session Routine',
  timeline: [
    { period: 'Check-in & Health Check', title: 'Welcome and quick health review' },
    { period: 'Life Jacket Fitting', title: 'Safe fit and comfort check' },
    { period: 'Warm-up Walk', title: 'Light warm-up before entering pool' },
    { period: 'Swimming Session', title: 'Supervised swim in the pool' },
    { period: 'Rinse & Towel Dry', title: 'Post-swim rinse and drying' },
    { period: 'Playtime', title: 'Optional play after swim' },
    { period: 'Check-out', title: 'Pickup and handover' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Exact session schedules vary by facility.',
    'Share any medical conditions or joint issues before swimming.',
    'Vaccination records may be required.',
    'Avoid feeding immediately before a swim session.',
    'Facility-specific health, vaccination and behavior requirements may apply.',
  ],
  tips: [],
  benefits: [],
});
