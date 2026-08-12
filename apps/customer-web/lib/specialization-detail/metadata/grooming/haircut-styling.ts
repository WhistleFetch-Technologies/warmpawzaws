import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const haircutStylingMetadata = defineSpecialization({
  id: 'haircut_styling',
  category: 'grooming',
  title: 'Hair Styling',
  description:
    'Professional hair and fur trimming designed to maintain your pet\'s coat length, shape and overall appearance.',
  heroImage: '/images/home/Grooming/haircut.webp',
  highlightChips: ['Hair Trim', 'Coat Styling', 'Neat Finish'],
  whatsIncluded: [
    { label: 'Coat Assessment', icon: 'check' },
    { label: 'Brushing', icon: 'check' },
    { label: 'Coat Preparation', icon: 'sparkles' },
    { label: 'Hair/Fur Trimming', icon: 'star' },
    { label: 'Face Area Trimming', icon: 'heart' },
    { label: 'Paw Area Trimming', icon: 'check' },
    { label: 'Ear-Area Grooming where appropriate', icon: 'heart' },
    { label: 'Final Brushing & Styling', icon: 'award' },
  ],
  benefits: [
    { title: 'Neater appearance', description: 'Coat length and shape are maintained professionally.', icon: 'sparkles' },
    { title: 'Easier coat maintenance', description: 'Regular trims simplify brushing at home.', icon: 'check' },
    { title: 'Better grooming between appointments', description: 'Keeps the coat manageable until the next visit.', icon: 'star' },
    { title: 'Comfortable coat length', description: 'Trimming supports comfort and mobility.', icon: 'heart' },
  ],
  whoIsThisFor: [
    'Pets needing regular hair trimming',
    'Long-haired pets',
    'Pets requiring coat maintenance',
    'Pets needing a cleaner styled appearance',
  ],
  timelineTitle: 'Process',
  timeline: [
    { period: 'Step 1', title: 'Coat assessment' },
    { period: 'Step 2', title: 'Determine required trim' },
    { period: 'Step 3', title: 'Brush and prepare coat' },
    { period: 'Step 4', title: 'Trim and shape' },
    { period: 'Step 5', title: 'Final styling' },
  ],
  tips: [
    'Share preferred coat length/style',
    'Mention sensitive areas',
    'Inform the groomer about previous grooming experiences',
  ],
  serviceModeInformation: groomingServiceModes(),
});
