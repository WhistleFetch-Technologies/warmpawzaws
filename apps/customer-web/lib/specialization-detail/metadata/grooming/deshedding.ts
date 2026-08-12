import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const desheddingMetadata = defineSpecialization({
  id: 'deshedding',
  category: 'grooming',
  title: 'Shedding Control',
  description:
    'A coat-care service focused on removing loose and shedding fur through brushing and deshedding techniques.',
  heroImage: '/images/home/Grooming/shedding-control.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Deshedding', 'Coat Care', 'Loose Fur Removal'],
  whatsIncluded: [
    { label: 'Coat Assessment', icon: 'check' },
    { label: 'Pre-Brushing', icon: 'check' },
    { label: 'Deshedding', icon: 'sparkles' },
    { label: 'Loose Fur Removal', icon: 'star' },
    { label: 'Coat Brushing', icon: 'check' },
    { label: 'Final Coat Finishing', icon: 'award' },
  ],
  benefits: [
    { title: 'Removes loose fur', description: 'Targets shedding undercoat and loose hair.', icon: 'sparkles' },
    { title: 'Helps maintain the coat', description: 'Supports healthier, more manageable coat condition.', icon: 'check' },
    { title: 'Cleaner-looking coat', description: 'Leaves the coat looking fresher and neater.', icon: 'star' },
    {
      title: 'Reduces loose hair around the pet\'s environment',
      description: 'Helps reduce fur on furniture and floors.',
      icon: 'home',
    },
  ],
  whoIsThisFor: [
    'Heavy-shedding pets',
    'Pets with loose undercoat',
    'Dogs/cats needing regular deshedding',
    'Pets between full grooming appointments',
  ],
  timelineTitle: 'Process',
  timeline: [
    { period: 'Step 1', title: 'Coat assessment' },
    { period: 'Step 2', title: 'Identify shedding areas' },
    { period: 'Step 3', title: 'Brush and loosen dead/loose fur' },
    { period: 'Step 4', title: 'Deshedding session' },
    { period: 'Step 5', title: 'Final coat brushing' },
  ],
  tips: [
    'Tell the groomer about coat type',
    'Mention matting or sensitive areas',
    'Do not treat this service as a replacement for medical skin treatment',
  ],
  serviceModeInformation: groomingServiceModes(),
});
