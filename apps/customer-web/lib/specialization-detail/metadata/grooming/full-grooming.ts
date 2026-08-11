import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const fullGroomingMetadata = defineSpecialization({
  id: 'full_grooming',
  category: 'grooming',
  title: 'Complete Grooming',
  description:
    'A comprehensive grooming session combining essential bathing, coat care, brushing and hygiene services to keep your pet clean and well-maintained.',
  heroImage: '/images/home/Grooming/complete-grooming.webp',
  heroImagePosition: 'center 45%',
  highlightChips: ['Full Grooming', 'Coat Care', 'Pet Hygiene'],
  whatsIncluded: [
    { label: 'Coat Assessment', icon: 'check' },
    { label: 'Pre-Grooming Brushing', icon: 'check' },
    { label: 'Bath', icon: 'sparkles' },
    { label: 'Shampoo & Conditioning', icon: 'leaf' },
    { label: 'Blow Dry', icon: 'home' },
    { label: 'Full Coat Brushing', icon: 'check' },
    { label: 'Basic Hair/Fur Trimming', icon: 'star' },
    { label: 'Nail Care', icon: 'star' },
    { label: 'Final Grooming', icon: 'award' },
  ],
  benefits: [
    { title: 'Cleaner overall coat', description: 'Combines bathing and coat care in one session.', icon: 'sparkles' },
    { title: 'Better grooming maintenance', description: 'Keeps your pet well-maintained between visits.', icon: 'check' },
    { title: 'Reduced loose fur', description: 'Brush-out and finishing help manage shedding.', icon: 'star' },
    { title: 'Improved overall appearance', description: 'Your pet looks neat, clean, and comfortable.', icon: 'award' },
  ],
  whoIsThisFor: [
    'Pets needing complete routine grooming',
    'Pets between regular grooming appointments',
    'Pets requiring combined coat and hygiene care',
  ],
  timelineTitle: 'Process',
  timeline: [
    { period: 'Step 1', title: 'Coat assessment' },
    { period: 'Step 2', title: 'Brushing and preparation' },
    { period: 'Step 3', title: 'Bath and cleansing' },
    { period: 'Step 4', title: 'Drying and coat finishing' },
    { period: 'Step 5', title: 'Final grooming and hygiene check' },
  ],
  tips: [
    'Tell the groomer about sensitive areas',
    'Mention previous grooming reactions',
    'Keep the pet comfortable before the appointment',
    'Inform the groomer about special coat requirements',
  ],
  serviceModeInformation: groomingServiceModes({
    at_center: {
      title: 'Visit a professional grooming centre',
      description:
        'Complete grooming is performed at the centre using professional bathing, drying, and finishing equipment.',
    },
  }),
});
