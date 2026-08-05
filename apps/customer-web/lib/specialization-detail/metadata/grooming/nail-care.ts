import { defineSpecialization } from '../../define';

export const nailCareMetadata = defineSpecialization({
  id: 'nail_care',
  category: 'grooming',
  title: 'Nail Care',
  description:
    'Professional nail trimming and filing to keep paws comfortable, protect floors and furniture, and prevent painful overgrowth or splitting.',
  highlightChips: ['Gentle Handling', 'Quick Service', 'Paw Health'],
  whatsIncluded: [
    { label: 'Nail Trim', icon: 'star' },
    { label: 'Nail Filing', icon: 'check' },
    { label: 'Paw Pad Check', icon: 'heart' },
    { label: 'Quick Buff', icon: 'sparkles' },
    { label: 'Calm Restraint', icon: 'shield' },
    { label: 'Aftercare Tips', icon: 'home' },
  ],
  benefits: [
    { title: 'Comfortable Paws', description: 'Proper length prevents splaying and joint strain.', icon: 'heart' },
    { title: 'Less Scratching', description: 'Smoother nails are gentler on skin and surfaces.', icon: 'check' },
    { title: 'Injury Prevention', description: 'Reduces snagging, splitting, and painful breaks.', icon: 'shield' },
    { title: 'Stress-Free Visit', description: 'Patient groomers trained for nail-anxious pets.', icon: 'dog' },
  ],
  whoIsThisFor: ['Dogs with fast-growing nails', 'Pets nervous about nail trims', 'Owners who prefer professional handling'],
  timeline: [
    { period: 'Check-in', title: 'Paw inspection and comfort assessment' },
    { period: 'Trim', title: 'Careful nail shortening' },
    { period: 'File', title: 'Smooth edges and paw pad review' },
    { period: 'Finish', title: 'Home maintenance guidance' },
  ],
  tips: ['Walk on pavement to naturally wear nails between visits', 'Book before nails touch the ground when standing', 'Reward calm behaviour after the visit', 'Inform groomer of any past quick bleeding'],
});
