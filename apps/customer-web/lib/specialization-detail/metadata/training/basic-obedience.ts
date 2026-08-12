import { defineSpecialization } from '../../define';
import { trainingBenefits, trainingFeatures } from './training-content-helpers';
import { trainingServiceModes } from './training-service-mode-defaults';

export const basicObedienceMetadata = defineSpecialization({
  id: 'basic_obedience',
  category: 'training',
  title: 'Basic Obedience',
  description:
    'Positive, reward-based training that teaches dogs essential commands and everyday manners while improving communication between the pet and pet parent.',
  heroImage: '/images/home/Training/basic-obedience-training.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Basic Commands', 'Impulse Control', 'Everyday Manners'],
  whatYouLearn: [
    'Name Recognition',
    'Attention',
    'Sit',
    'Down',
    'Stay',
    'Come / Recall',
    'Wait',
    'Leave It',
    'Basic Impulse Control',
    'Polite Greetings',
    'Basic Leash Manners',
  ],
  whatsIncluded: [],
  trainerDelivers: [
    'Demonstrates each command',
    'Works directly with the pet',
    'Explains the correct training technique',
    'Guides the pet parent',
    'Uses reward-based learning',
    'Provides practice exercises for home',
  ],
  benefits: trainingBenefits([
    { title: 'Better communication', icon: 'heart' },
    { title: 'Improved responsiveness', icon: 'check' },
    { title: 'Better impulse control', icon: 'brain' },
    { title: 'Better everyday manners', icon: 'star' },
    { title: 'Improved ability to follow basic commands', icon: 'graduation' },
  ]),
  whoIsThisFor: [
    'Puppies starting obedience training',
    'Adult dogs starting obedience training',
    'Dogs needing better everyday responsiveness',
  ],
  audienceTitle: 'Who Is This Training For?',
  timeline: [],
  tips: [],
  notIncluded: [
    'Aggression',
    'Severe anxiety or fear',
    'Separation anxiety',
    'Excessive barking',
    'Complex behavioural concerns',
  ],
  notIncludedFooter:
    'Complex behavioural concerns should be addressed through Behaviour Modification rather than Basic Obedience.',
  serviceModeInformation: trainingServiceModes({
    at_home: {
      title: 'Basic Obedience Training – At Home',
      description:
        "The trainer visits the pet's home and works with the dog in its familiar environment.",
      details: [
        'Essential commands',
        'Basic impulse control',
        'Polite greetings',
        'Basic leash manners',
        'Reward-based learning',
        'Pet-parent guidance',
        'Home practice exercises',
      ],
    },
    at_center: {
      title: 'Basic Obedience Training – At Centre',
      description: 'Structured training in a professional environment.',
      details: [
        'Essential commands',
        'Focus and attention',
        'Impulse control',
        'Polite greetings',
        'Basic leash manners',
        'Appropriate distractions',
        'Reward-based learning',
        'Exercises for the pet parent to continue at home',
      ],
    },
  }),
});
