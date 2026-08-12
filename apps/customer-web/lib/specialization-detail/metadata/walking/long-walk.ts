import { defineSpecialization } from '../../define';
import { walkingFeatures } from './walking-content-helpers';

export const longWalkMetadata = defineSpecialization({
  id: 'long_walk',
  category: 'walking',
  title: 'Adventure Walks',
  description:
    'Enrichment-focused outdoor walks through suitable parks and trails, giving dogs more opportunities to explore, sniff and stay active.',
  heroImage: '/images/home/Walking/adventure-walking-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Parks & Trails', 'Exploration', 'Active Exercise'],
  overviewTitle: 'What are Adventure Walks?',
  overviewBody:
    'Longer or more exploration-focused outdoor walks designed for dogs that enjoy discovering new environments and can comfortably handle the activity.',
  whatsIncludedTitle: 'What is included',
  whatsIncluded: walkingFeatures([
    'Park/trail exploration',
    'Leash-based walking',
    'Sniffing and environmental enrichment',
    'Varied but suitable terrain',
    'Exercise and exploration',
    'Rest and water breaks',
    'Supervised outdoor activity',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Healthy adult dogs',
    'Active dogs',
    'Dogs comfortable in outdoor environments',
    'Dogs with appropriate leash manners',
    'Dogs physically capable of longer walks',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  notIncludedTitle: 'Not suitable for',
  notIncluded: [
    'Very young puppies',
    'Dogs with significant mobility limitations',
    'Dogs that are highly reactive or aggressive',
    'Dogs not comfortable in unfamiliar environments',
    'Dogs unable to safely manage the route',
  ],
  importantNotesTitle: 'Safety & Route Suitability',
  importantNotes: [
    "The route and activity level should be appropriate for the dog's age, fitness, temperament and ability to safely handle the environment.",
  ],
});
