import { defineSpecialization } from '../../define';

export const desheddingMetadata = defineSpecialization({
  id: 'deshedding',
  category: 'grooming',
  title: 'De-shedding Treatment',
  description:
    'Deep de-shedding treatment to remove loose undercoat, reduce fur around your home, and keep double-coated breeds comfortable year-round.',
  highlightChips: ['Undercoat Removal', 'Seasonal Relief', 'Coat Health'],
  whatsIncluded: [
    { label: 'Undercoat Rake', icon: 'check' },
    { label: 'De-shed Bath', icon: 'sparkles' },
    { label: 'High-Velocity Dry', icon: 'activity' },
    { label: 'Finishing Brush', icon: 'star' },
    { label: 'Coat Conditioner', icon: 'leaf' },
    { label: 'Shedding Schedule Advice', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Less Home Fur', description: 'Significantly reduces loose hair on furniture and clothes.', icon: 'home' },
    { title: 'Cooler Comfort', description: 'Removes trapped undercoat that causes overheating.', icon: 'sun' },
    { title: 'Healthier Skin', description: 'Better airflow to the skin reduces hot spots.', icon: 'heart' },
    { title: 'Easier Brushing', description: 'Coat stays manageable between professional sessions.', icon: 'check' },
  ],
  whoIsThisFor: ['Huskies, retrievers, and double coats', 'Heavy seasonal shedders', 'Allergy-conscious households'],
  timeline: [
    { period: 'Prep', title: 'Coat assessment and initial rake-out' },
    { period: 'Bath', title: 'De-shed shampoo and conditioner' },
    { period: 'Dry', title: 'Blow-out to release trapped fur' },
    { period: 'Finish', title: 'Final brush and maintenance plan' },
  ],
  tips: ['Never shave double-coated breeds unless vet-advised', 'Book before peak shedding seasons', 'Brush weekly between treatments', 'Increase frequency during spring and autumn'],
});
