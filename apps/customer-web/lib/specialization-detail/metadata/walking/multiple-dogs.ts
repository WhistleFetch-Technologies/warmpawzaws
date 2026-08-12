import { defineSpecialization } from '../../define';
import { walkingFeatures } from './walking-content-helpers';

export const multipleDogsMetadata = defineSpecialization({
  id: 'multiple_dogs',
  category: 'walking',
  title: 'Group Walks',
  description:
    'Supervised group walks that combine exercise, outdoor enrichment and appropriate social exposure around other dogs.',
  heroImage: '/images/home/Walking/group-walking-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Social & Active', 'Pack Walking', 'Supervised Group'],
  overviewTitle: 'What are Group Walks?',
  overviewBody:
    'A supervised walk where compatible dogs walk together in a controlled group environment.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: walkingFeatures([
    'Supervised group walking',
    'Leash-based walking',
    'Controlled interaction',
    'Outdoor exercise',
    'Social exposure',
    'Sniffing and exploration',
    'Group safety supervision',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Social and comfortable dogs',
    'Dogs comfortable around other dogs',
    'Dogs with suitable basic leash manners',
    'Dogs that enjoy group environments',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  notIncludedTitle: 'Not suitable for',
  notIncluded: [
    'Highly reactive dogs',
    'Dogs showing aggression toward other dogs or people',
    'Dogs that become highly stressed in groups',
    'Dogs that cannot safely be managed around other dogs',
  ],
  importantNotesTitle: 'Safety & Compatibility',
  importantNotes: [
    'Dogs should be grouped based on compatibility, temperament and safety. Group walking does not mean that every dog will interact or play with every other dog.',
  ],
});
