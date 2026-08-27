import { defineSpecialization } from '@/lib/specialization-detail/define';

/** Static service copy for the Overnight Sitting details page only. */
export const overnightSittingMetadata = defineSpecialization({
  id: 'overnight_sitting',
  category: 'general',
  title: 'Overnight Sitting',
  description:
    "Loving sitters stay overnight at your home to keep your pet comfortable, safe and happy while you're away.",
  heroImage: '/images/home/Sitting/overnight-sitting-detail-hero.webp',
  heroImagePosition: 'center 45%',
  highlightChips: ['Stay at Home', 'Safe & Trusted', '24×7 Care'],
  whatsIncluded: [
    { label: 'Overnight stay at your home', icon: 'home' },
    { label: 'Feeding as per routine', icon: 'heart' },
    { label: 'Regular potty breaks', icon: 'check' },
    { label: 'Playtime & companionship', icon: 'activity' },
    { label: 'Medication administration', icon: 'shield' },
    { label: 'Photo & video updates', icon: 'sparkles' },
    { label: 'Home security & care', icon: 'shield' },
  ],
  whoIsThisFor: [
    'Pet parents on vacations',
    'Business trips & late returns',
    'Pets with separation anxiety',
    'Senior pets needing extra care',
    'Avoiding long crate time',
  ],
  audienceTitle: 'Best For',
  timelineTitle: 'Overnight Routine',
  timeline: [
    { period: 'Evening Check-in', title: 'Sitter arrives and settles in' },
    { period: 'Dinner', title: 'Scheduled evening feeding' },
    { period: 'Evening Walk', title: 'Walk and potty break' },
    { period: 'Playtime & Cuddles', title: 'Quality time with your pet' },
    { period: 'Good Night Care', title: 'Comfortable overnight care' },
    { period: 'Morning Walk', title: 'Morning walk and potty break' },
    { period: 'Breakfast & Updates', title: 'Morning feed and photo updates' },
  ],
  importantNotesTitle: 'Important Notes',
  importantNotes: [
    'Exact schedules vary by sitter.',
    "Sitters follow your pet's routine.",
    'Pets may be grouped separately based on temperament & policy.',
    'Prior meet & greet recommended.',
  ],
  benefits: [
    {
      title: 'Home Comfort',
      description: 'Your pet stays in their own environment.',
      icon: 'home',
    },
    {
      title: 'One-on-One Care',
      description: 'Personalized attention from trusted sitters.',
      icon: 'shield',
    },
    {
      title: 'Peace of Mind',
      description: 'Real-time updates for complete reassurance.',
      icon: 'heart',
    },
  ],
  tips: [],
});
