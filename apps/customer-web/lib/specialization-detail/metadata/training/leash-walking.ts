import { defineSpecialization } from '../../define';
import { trainingBenefits, trainingFeatures } from './training-content-helpers';
import { trainingServiceModes } from './training-service-mode-defaults';

export const leashWalkingMetadata = defineSpecialization({
  id: 'leash_walking',
  aliases: ['leash_training'],
  category: 'training',
  title: 'Leash Walking',
  description:
    'Training that helps dogs develop calm, controlled and comfortable walking habits without excessive pulling or lunging.',
  heroImage: '/images/home/Training/leash-walking-training.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Loose Leash', 'Walking Manners', 'Outdoor Focus'],
  whatYouLearn: [
    'Loose-leash walking',
    'Better response to leash cues',
    'Reduced pulling',
    'Handler focus',
    'Basic walking manners',
    'Appropriate response to distractions',
    'Calm walking',
    'Controlled direction changes',
    'Reward-based walking',
  ],
  whatsIncluded: trainingFeatures([
    'Trainer assessment',
    'Leash-handling guidance',
    'Practical walking exercises',
    'Reward-based training',
    'Distraction management',
    'Pet-parent coaching',
    'Home practice exercises',
  ]),
  behavioursAddressedTitle: 'Behaviours Addressed',
  behavioursAddressed: [
    'Excessive pulling',
    'Lunging',
    'Poor leash manners',
    'Difficulty focusing outdoors',
    'Reactivity during walks',
  ],
  benefits: trainingBenefits([
    { title: 'More enjoyable walks', icon: 'heart' },
    { title: 'Better control', icon: 'shield' },
    { title: 'Improved focus', icon: 'brain' },
    { title: 'Reduced pulling', icon: 'check' },
    { title: 'Safer outdoor handling', icon: 'footprints' },
  ]),
  whoIsThisFor: [
    'Puppies learning leash manners',
    'Adult dogs that pull',
    'Dogs needing better outdoor responsiveness',
    'Dogs struggling with distractions during walks',
  ],
  audienceTitle: 'Who Is This Training For?',
  timeline: [],
  tips: [],
  notIncluded: [
    'Medical rehabilitation',
    'Medical treatment',
    'Severe behavioural cases requiring specialist behaviour modification',
    'Strenuous exercise programmes',
  ],
  importantNotes: [
    'Senior Dog Walk and Leash Walking Training are different services.',
    'Do not use Senior Dog Walk content as if it were Leash Walking Training.',
  ],
  serviceModeInformation: trainingServiceModes({
    at_home: {
      title: 'Leash Walking – At Home',
      description: 'Practical leash training starting from your home environment.',
      details: [
        'Basic leash handling',
        'Walking manners',
        'Focus building',
        'Reward-based exercises',
        'Pet-parent coaching',
      ],
    },
    at_center: {
      title: 'Leash Walking – At Centre',
      description: 'Structured walking exercises in a professional setting.',
      details: [
        'Structured walking exercises',
        'Controlled distractions',
        'Focus training',
        'Leash response',
        'Walking manners',
      ],
    },
  }),
});
