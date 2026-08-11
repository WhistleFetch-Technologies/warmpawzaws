import { defineSpecialization } from '../../define';
import { trainingBenefits, trainingFeatures } from './training-content-helpers';
import { trainingServiceModes } from './training-service-mode-defaults';

export const houseTrainingMetadata = defineSpecialization({
  id: 'house_training',
  aliases: ['potty_training'],
  category: 'training',
  title: 'House Training',
  description:
    'Practical training designed to help dogs build consistent toilet routines and appropriate indoor habits.',
  heroImage: '/images/home/Training/house-training-training.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Toilet Training', 'Home Routine', 'Positive Reinforcement'],
  whatYouLearn: [
    'Consistent toilet routines',
    'Recognising toilet cues',
    'Appropriate toilet-area behaviour',
    'Predictable schedules',
    'Rewarding desired behaviour',
    'Managing indoor accidents',
    'Consistent pet-parent routines',
    'Reinforcing good habits',
  ],
  whatsIncluded: trainingFeatures([
    'Assessment of the current routine',
    'Practical demonstrations',
    'Positive reinforcement guidance',
    'Routine-building guidance',
    'Pet-parent coaching',
    'Home practice plan',
  ]),
  benefits: trainingBenefits([
    { title: 'Better routine', icon: 'calendar' },
    { title: 'Fewer indoor accidents', icon: 'home' },
    { title: 'Clearer communication', icon: 'heart' },
    { title: 'More predictable behaviour', icon: 'check' },
    { title: 'Better household management', icon: 'star' },
  ]),
  whoIsThisFor: ['Puppies', 'Newly adopted dogs', 'Dogs struggling with inconsistent toilet habits'],
  audienceTitle: 'Who Is This Training For?',
  timeline: [],
  tips: [],
  notIncluded: [
    'Medical diagnosis',
    'Medical treatment',
    'Treatment of urinary/fecal medical conditions',
    'Behaviour problems unrelated to house training',
  ],
  serviceModeInformation: trainingServiceModes({
    at_home: {
      title: 'House Training – At Home',
      description: 'Toilet training guidance in your home environment.',
      details: [
        'Observe the home environment',
        'Review current toilet routine',
        'Establish a consistent routine',
        'Demonstrate positive reinforcement',
        'Guide the pet parent',
        'Create a home practice plan',
      ],
    },
  }),
});
