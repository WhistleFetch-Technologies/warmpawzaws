import { defineSpecialization } from '../../define';
import { walkingFeatures } from './walking-content-helpers';

export const puppyWalkMetadata = defineSpecialization({
  id: 'puppy_walk',
  category: 'walking',
  title: 'Puppy Walks',
  description:
    'Gentle, age-appropriate walks designed to help puppies build confidence, explore safely and develop positive outdoor walking habits.',
  heroImage: '/images/home/Walking/puppy-walking-detail.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Puppy Care', 'Gentle Exercise', 'Early Socialisation'],
  overviewTitle: 'What are Puppy Walks?',
  overviewBody:
    "Short and gentle walks designed around a puppy's developing body, attention span and comfort level.",
  whatsIncludedTitle: 'What is included',
  whatsIncluded: walkingFeatures([
    'Short supervised walks',
    'Gentle walking pace',
    'Sniffing and exploration',
    'Positive reinforcement',
    'Basic leash exposure',
    'Gradual exposure to normal outdoor sights and sounds',
    'Regular rest breaks',
  ]),
  benefits: [],
  whoIsThisFor: [
    'Puppies beginning outdoor walking',
    'Puppies learning leash manners',
    'Puppies needing controlled outdoor exposure',
  ],
  audienceTitle: 'Best suited for',
  timeline: [],
  tips: [],
  notIncludedTitle: 'Not included',
  notIncluded: [
    'Long-distance walking',
    'Strenuous exercise',
    'Off-leash activity',
    'Group walking unless specifically suitable',
    'Behaviour modification',
  ],
  importantNotesTitle: 'Important',
  importantNotes: [
    "Puppies should not automatically be treated like adult dogs. Outdoor exposure should take the puppy's vaccination status and appropriate veterinary guidance into account.",
  ],
});
