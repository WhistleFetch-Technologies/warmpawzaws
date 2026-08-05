import { defineSpecialization } from '../../define';

export const haircutStylingMetadata = defineSpecialization({
  id: 'haircut_styling',
  category: 'grooming',
  title: 'Haircut & Styling',
  description:
    'Breed-specific or custom haircuts that balance appearance, comfort, and coat health—with skilled scissoring and clipper work for a neat finish.',
  highlightChips: ['Custom Styles', 'Breed Expertise', 'Precision Cut'],
  whatsIncluded: [
    { label: 'Style Consultation', icon: 'check' },
    { label: 'Pre-Groom Brush-Out', icon: 'sparkles' },
    { label: 'Precision Haircut', icon: 'star' },
    { label: 'Face & Feet Trim', icon: 'heart' },
    { label: 'Blend & Finish', icon: 'award' },
    { label: 'Style Maintenance Tips', icon: 'home' },
  ],
  benefits: [
    { title: 'Polished Appearance', description: 'A neat silhouette that suits your pet\'s breed and lifestyle.', icon: 'sparkles' },
    { title: 'Better Comfort', description: 'Shorter coats stay cooler and tangle less.', icon: 'heart' },
    { title: 'Easier Home Care', description: 'Regular trims simplify brushing between visits.', icon: 'check' },
    { title: 'Professional Finish', description: 'Even lines and balanced proportions.', icon: 'award' },
  ],
  whoIsThisFor: ['Poodles, terriers, and clip breeds', 'Long-coated dogs needing shape', 'Owners wanting a specific look'],
  timeline: [
    { period: 'Consult', title: 'Discuss style, length, and reference photos' },
    { period: 'Prep', title: 'Wash, dry, and detangle' },
    { period: 'Cut', title: 'Scissor and clipper work' },
    { period: 'Review', title: 'Final blend and owner walkthrough' },
  ],
  tips: ['Bring reference photos of your preferred style', 'Allow 4–6 weeks between full styling sessions', 'Brush daily to prevent matting before cuts', 'Share if your pet has skin bumps or moles'],
});
