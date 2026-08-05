import { defineSpecialization } from '../../define';

export const hairTrimMetadata = defineSpecialization({
  id: 'hair_trim',
  category: 'grooming',
  title: 'Hair Trim',
  description:
    'Targeted trimming for face, feet, sanitary areas, and touch-ups between full grooms—keeping your pet neat without a complete restyle.',
  highlightChips: ['Quick Touch-Up', 'Hygiene Focus', 'Between-Groom Care'],
  whatsIncluded: [
    { label: 'Face Trim', icon: 'check' },
    { label: 'Feet & Paw Trim', icon: 'footprints' },
    { label: 'Sanitary Trim', icon: 'shield' },
    { label: 'Light Body Tidy', icon: 'star' },
    { label: 'Brush-Out', icon: 'sparkles' },
    { label: 'Quick Nail Check', icon: 'heart' },
  ],
  benefits: [
    { title: 'Neat Appearance', description: 'Eyes, feet, and rear stay clean between full grooms.', icon: 'sparkles' },
    { title: 'Better Hygiene', description: 'Sanitary trims reduce matting and odour.', icon: 'shield' },
    { title: 'Clear Vision', description: 'Face trims keep hair out of eyes.', icon: 'check' },
    { title: 'Affordable Maintenance', description: 'Shorter visits than a full groom.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Breeds needing frequent face and foot trims', 'Between full grooming appointments', 'Quick tidy-ups before travel'],
  timeline: [
    { period: 'Check-in', title: 'Identify areas needing trim' },
    { period: 'Trim', title: 'Face, feet, and sanitary work' },
    { period: 'Tidy', title: 'Light body touch-up if needed' },
    { period: 'Finish', title: 'Brush-out and review' },
  ],
  tips: ['Book every 2–4 weeks for high-maintenance coats', 'Specify which areas bother you most', 'Combine with nail care if overdue', 'Keep up brushing to extend trim results'],
});
