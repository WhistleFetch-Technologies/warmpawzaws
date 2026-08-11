import { defineSpecialization } from '../../define';

export const luxuryBoardingMetadata = defineSpecialization({
  id: 'luxury_boarding',
  category: 'boarding',
  title: 'Luxury Boarding',
  description:
    'Premium boarding with spacious suites, enhanced amenities, personalized attention, and extra comfort for pets who deserve a five-star stay.',
  highlightChips: ['Premium Suites', 'Extra Attention', 'Enhanced Comfort'],
  whatsIncluded: [
    { label: 'Spacious Private Suite', icon: 'home' },
    { label: 'Premium Bedding', icon: 'sparkles' },
    { label: 'Extra Play Sessions', icon: 'activity' },
    { label: 'Gourmet Meal Options', icon: 'heart' },
    { label: 'Photo Updates', icon: 'star' },
    { label: 'One-on-One Attention', icon: 'dog' },
  ],
  benefits: [
    { title: 'Maximum Comfort', description: 'Roomier spaces and softer bedding for restful stays.', icon: 'home' },
    { title: 'Personalized Care', description: 'Staff tuned to your pet\'s preferences and quirks.', icon: 'heart' },
    { title: 'Extra Enrichment', description: 'More playtime and stimulation than standard boarding.', icon: 'activity' },
    { title: 'Owner Connection', description: 'Regular photo and status updates while you travel.', icon: 'star' },
  ],
  whoIsThisFor: ['Owners wanting premium care', 'Anxious pets needing extra attention', 'Special occasions and extended luxury stays'],
  timeline: [
    { period: 'Arrival', title: 'Suite tour and comfort setup' },
    { period: 'Daily', title: 'Premium meals, play, and rest' },
    { period: 'Enrichment', title: 'Extra activities and one-on-one time' },
    { period: 'Departure', title: 'Relaxed handover and stay summary' },
  ],
  tips: ['Book well in advance for peak seasons', 'Share favourite toys and bedding', 'Specify dietary preferences clearly', 'Ask about webcam or update frequency'],
});
