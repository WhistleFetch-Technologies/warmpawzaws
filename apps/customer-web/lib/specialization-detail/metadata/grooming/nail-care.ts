import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const nailCareMetadata = defineSpecialization({
  id: 'nail_care',
  category: 'grooming',
  title: 'Nail Trimming',
  description:
    'Routine nail-care service to safely trim your pet\'s nails and maintain comfortable paw hygiene.',
  heroImage: '/images/home/Grooming/nail-trimming.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Paw Care', 'Nail Hygiene', 'Gentle Handling'],
  whatsIncluded: [
    { label: 'Paw Inspection', icon: 'check' },
    { label: 'Nail Length Assessment', icon: 'check' },
    { label: 'Nail Trimming', icon: 'star' },
    { label: 'Nail Edge Smoothing where appropriate', icon: 'sparkles' },
    { label: 'Paw Check', icon: 'heart' },
    { label: 'Final Clean-Up', icon: 'home' },
  ],
  benefits: [
    { title: 'Maintains comfortable nail length', description: 'Helps prevent overgrowth and discomfort.', icon: 'heart' },
    { title: 'Supports regular paw hygiene', description: 'Keeps paws clean and well maintained.', icon: 'check' },
    { title: 'Helps prevent overgrown nails', description: 'Routine trims reduce splitting and snagging.', icon: 'shield' },
    { title: 'Keeps paws well maintained', description: 'Professional handling for nail-anxious pets.', icon: 'star' },
  ],
  whoIsThisFor: [
    'Pets with overgrown nails',
    'Pets needing routine nail maintenance',
    'Dogs and cats requiring regular paw care',
  ],
  timelineTitle: 'Process',
  timeline: [
    { period: 'Step 1', title: 'Inspect paws' },
    { period: 'Step 2', title: 'Assess nail length' },
    { period: 'Step 3', title: 'Carefully trim nails' },
    { period: 'Step 4', title: 'Smooth/check edges' },
    { period: 'Step 5', title: 'Final paw check' },
  ],
  tips: [
    'Tell the groomer if your pet is nervous with paw handling',
    'Mention previous nail-trimming issues',
    'Keep the pet calm before the appointment',
  ],
  serviceModeInformation: groomingServiceModes(),
});
