import { defineSpecialization } from '../../define';
import { walkingFeatures } from './walking-content-helpers';

export const dailyWalkMetadata = defineSpecialization({
  id: 'daily_walk',
  category: 'walking',
  title: 'Daily Walking',
  description:
    'Regular, supervised walks designed to provide healthy exercise, outdoor enrichment and a consistent walking routine for your dog.',
  heroImage: '/images/home/Walking/daily-walking-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Regular Exercise', 'Daily Routine', 'Outdoor Enrichment'],
  overviewTitle: 'What is Daily Walking?',
  overviewBody:
    'A regular supervised walk where the walker takes the dog outdoors at a comfortable pace, allowing exercise, sniffing and exploration while maintaining safe leash control.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: walkingFeatures([
    'Leash-based walking',
    'Comfortable walking pace',
    'Regular sniffing and exploration',
    'Basic supervision',
    'Safe route selection',
    'Water/rest break when required',
    'Basic cleanup after the walk',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Healthy adult dogs',
    'Dogs needing regular exercise',
    'Dogs whose parents have busy schedules',
    'Dogs that enjoy regular outdoor walks',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  notIncludedTitle: 'Not included',
  notIncluded: [
    'Running or strenuous exercise',
    'Off-leash activity',
    'Behaviour modification',
    'Medical or rehabilitation exercises',
  ],
  notIncludedFooter:
    'The focus is regular exercise, routine, enrichment and safe supervised walking.',
});
