import { defineSpecialization } from '../../define';

export const fullGroomingMetadata = defineSpecialization({
  id: 'full_grooming',
  category: 'grooming',
  title: 'Full Grooming',
  description:
    'Complete grooming service covering bath, haircut, nails, ears, and finishing touches for a polished, comfortable, and hygienic look.',
  highlightChips: ['Full Service', 'Styling Options', 'Premium Finish'],
  whatsIncluded: [
    { label: 'Bath & Blow Dry', icon: 'sparkles' },
    { label: 'Haircut & Style', icon: 'check' },
    { label: 'Nail Trim', icon: 'star' },
    { label: 'Ear Cleaning', icon: 'heart' },
    { label: 'Sanitary Trim', icon: 'shield' },
    { label: 'Finishing Spray', icon: 'leaf' },
  ],
  benefits: [
    { title: 'Show-Ready Look', description: 'Neat coat and balanced silhouette.', icon: 'award' },
    { title: 'Full Hygiene', description: 'Ears, nails, and coat all cared for in one visit.', icon: 'shield' },
    { title: 'Lasting Comfort', description: 'Less matting, overheating, and skin irritation.', icon: 'heart' },
    { title: 'Professional Finish', description: 'Breed-appropriate styling by skilled groomers.', icon: 'sparkles' },
  ],
  whoIsThisFor: ['All coat types and sizes', 'Breeds needing regular clips', 'Special occasions and events'],
  timeline: [
    { period: 'Arrival', title: 'Consultation and coat check' },
    { period: 'Prep', title: 'Bath, dry, and thorough brush-out' },
    { period: 'Groom', title: 'Cut, nails, ears, and sanitary trim' },
    { period: 'Finish', title: 'Style review and home care tips' },
  ],
  tips: ['Arrive with a relatively dry coat if possible', 'Share photos of your desired style', 'Note any skin sensitivities upfront', 'Maintain a schedule every 4–8 weeks'],
});
