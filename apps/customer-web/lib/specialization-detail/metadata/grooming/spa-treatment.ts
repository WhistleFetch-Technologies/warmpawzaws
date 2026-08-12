import { defineSpecialization } from '../../define';
import { groomingServiceModes } from './grooming-service-mode-defaults';

export const spaTreatmentMetadata = defineSpecialization({
  id: 'spa_treatment',
  category: 'grooming',
  title: 'Spa Treatment',
  description:
    'A relaxing grooming experience focused on bathing, coat conditioning and gentle care for a cleaner, fresher and well-maintained pet.',
  heroImage: '/images/home/Grooming/spa-treatment.webp',
  heroImagePosition: 'center 40%',
  highlightChips: ['Relaxing Care', 'Coat Conditioning', 'Fresh & Clean'],
  whatsIncluded: [
    { label: 'Coat Assessment', icon: 'check' },
    { label: 'Gentle Bath', icon: 'sparkles' },
    { label: 'Pet-Safe Cleansing', icon: 'leaf' },
    { label: 'Conditioning', icon: 'leaf' },
    { label: 'Gentle Brushing', icon: 'check' },
    { label: 'Drying', icon: 'home' },
    { label: 'Coat Finishing', icon: 'star' },
    { label: 'Relaxed Grooming Experience', icon: 'heart' },
  ],
  benefits: [
    { title: 'Cleaner coat', description: 'Gentle cleansing leaves the coat fresh.', icon: 'sparkles' },
    { title: 'Fresh feeling', description: 'Conditioning supports a soft, refreshed coat.', icon: 'heart' },
    { title: 'Better coat maintenance', description: 'Helps maintain coat health between sessions.', icon: 'check' },
    { title: 'Relaxing grooming experience', description: 'Calm, gentle handling for a comfortable visit.', icon: 'star' },
  ],
  whoIsThisFor: [
    'Pets needing additional grooming care',
    'Pets between full grooming sessions',
    'Dogs/cats needing regular coat maintenance',
  ],
  timelineTitle: 'Process',
  timeline: [
    { period: 'Step 1', title: 'Coat assessment' },
    { period: 'Step 2', title: 'Gentle cleansing' },
    { period: 'Step 3', title: 'Conditioning' },
    { period: 'Step 4', title: 'Drying' },
    { period: 'Step 5', title: 'Brushing and finishing' },
  ],
  tips: [
    'Mention sensitive skin or coat areas',
    'Tell the groomer about previous grooming reactions',
    'Inform the groomer about your pet\'s temperament',
  ],
  serviceModeInformation: groomingServiceModes(),
});
