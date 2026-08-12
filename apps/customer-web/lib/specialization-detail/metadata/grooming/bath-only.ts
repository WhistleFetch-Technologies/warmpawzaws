import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const bathOnlyMetadata = defineSpecialization({
  id: 'bath_only',
  category: 'grooming',
  title: 'Bath Service',
  description:
    'Professional bathing and coat-care service designed to keep your pet clean, fresh, comfortable, and well-groomed.',
  heroImage: '/images/home/Grooming/bath-service.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Clean Coat', 'Fresh & Comfortable', 'Gentle Care'],
  whatsIncluded: [
    { label: 'Pre-Bath Brushing', icon: 'check' },
    { label: 'Coat Assessment', icon: 'check' },
    { label: 'Warm-Water Bath', icon: 'sparkles' },
    { label: 'Pet-Appropriate Shampoo', icon: 'leaf' },
    { label: 'Conditioner', icon: 'leaf' },
    { label: 'Thorough Rinsing', icon: 'check' },
    { label: 'Towel Drying / Blow Drying', icon: 'home' },
    { label: 'Basic Post-Bath Brushing', icon: 'check' },
  ],
  benefits: [
    { title: 'Cleaner Coat', description: 'Removes dirt and everyday buildup from the coat.', icon: 'sparkles' },
    { title: 'Fresher Pet', description: 'Leaves your pet feeling clean and refreshed.', icon: 'heart' },
    { title: 'Reduced Everyday Odour', description: 'Helps manage coat odour between grooming visits.', icon: 'check' },
    { title: 'Better Coat Maintenance', description: 'Supports routine coat care and comfort.', icon: 'star' },
  ],
  whoIsThisFor: [
    'Dogs needing routine bathing',
    'Cats needing regular hygiene',
    'Pets uncomfortable travelling to a grooming centre',
  ],
  timeline: [],
  tips: [],
  notIncluded: [
    'Haircuts or styling',
    'Breed-specific clipping',
    'Nail trimming',
    'Anal gland expression',
    'Medicated bathing',
    'Treatment of skin conditions unless specifically booked',
  ],
  serviceModeInformation: groomingServiceModes({
    at_home: {
      title: 'Grooming at your doorstep',
      description:
        'Professional groomer brings the required bathing equipment to the customer\'s home, prepares a safe bathing area, handles the pet gently and cleans the bathing area after completion.',
    },
    at_center: {
      title: 'Visit a professional grooming centre',
      description:
        'Professional bathing and drying equipment is used at the grooming centre. The pet is safely handled and returned clean, dry and comfortable.',
    },
  }),
});
