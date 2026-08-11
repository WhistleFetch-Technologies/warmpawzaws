import { defineSpecialization } from '../../define';
import { walkingFeatures } from './walking-content-helpers';

export const seniorWalkMetadata = defineSpecialization({
  id: 'senior_walk',
  category: 'walking',
  title: 'Senior Dog Walks',
  description:
    "Gentle, low-impact walks adapted to senior dogs' pace, comfort and mobility needs.",
  heroImage: '/images/home/Walking/senior-walking-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Gentle & Safe', 'Low Impact', 'Senior Care'],
  overviewTitle: 'What are Senior Dog Walks?',
  overviewBody:
    'Slow, comfortable walks designed for older dogs who benefit from regular movement without excessive physical exertion.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: walkingFeatures([
    'Slow walking pace',
    'Short walking sessions',
    'Frequent rest breaks',
    'Sniffing and mental enrichment',
    'Flat/even routes where possible',
    'Close monitoring for fatigue or discomfort',
    'Flexible return-home option',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Older dogs',
    'Dogs that prefer slower walks',
    'Dogs needing gentle outdoor activity',
    'Dogs with reduced stamina, subject to appropriate veterinary guidance',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  notIncludedTitle: 'Not included',
  notIncluded: [
    'Running',
    'Long-distance walks',
    'Steep or difficult routes',
    'Jumping or stair-heavy routes',
    'Rehabilitation exercises',
    'Medical treatment',
  ],
  importantNotesTitle: 'Comfort & Safety',
  importantNotes: [
    'The walker should follow the dog\'s comfortable pace and adjust the walk if the dog shows signs of fatigue, discomfort or difficulty continuing.',
  ],
});
