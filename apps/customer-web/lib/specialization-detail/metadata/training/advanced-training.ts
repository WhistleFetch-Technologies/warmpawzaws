import { defineSpecialization } from '../../define';
import { trainingBenefits, trainingFeatures } from './training-content-helpers';
import { trainingServiceModes } from './training-service-mode-defaults';

export const advancedTrainingMetadata = defineSpecialization({
  id: 'advanced_training',
  aliases: ['advanced_skills'],
  category: 'training',
  title: 'Advanced Training',
  description:
    'Structured training for dogs that have learned basic commands and are ready to build stronger focus, reliability and control in more challenging situations.',
  heroImage: '/images/home/Training/advanced-training.webp',
  heroImagePosition: 'center 40%',
  highlightChips: ['Advanced Commands', 'Focus & Control', 'Distraction Training'],
  whatYouLearn: [
    'Advanced command reliability',
    'Longer-duration Stay',
    'Reliable Recall',
    'Wait and impulse control',
    'Focus around distractions',
    'Advanced leash manners',
    'Responding to commands from greater distance',
    'Maintaining learned behaviours in different environments',
  ],
  whatsIncluded: trainingFeatures([
    'Trainer-led advanced exercises',
    'Progressive difficulty',
    'Distraction-based practice',
    'Reward-based reinforcement',
    'Pet-parent coaching',
    'Home practice exercises',
  ]),
  benefits: trainingBenefits([
    { title: 'Better command reliability', icon: 'graduation' },
    { title: 'Improved focus', icon: 'brain' },
    { title: 'Better impulse control', icon: 'check' },
    { title: 'Improved responsiveness', icon: 'heart' },
    { title: 'More manageable behaviour in different environments', icon: 'star' },
  ]),
  whoIsThisFor: [
    'Dogs that already know basic commands',
    'Dogs ready for more challenging training',
    'Pet parents wanting stronger command reliability',
  ],
  audienceTitle: 'Who Is This Training For?',
  timeline: [],
  tips: [],
  notIncluded: [
    'Medical treatment',
    'Rehabilitation',
    'Severe behavioural cases requiring specialist intervention',
  ],
  importantNotes: [
    'Advanced training builds on existing basic obedience skills.',
    'Unsupported advanced commands should not be presented as guaranteed outcomes.',
    'This service does not include medical claims or treatment.',
  ],
  serviceModeInformation: trainingServiceModes({
    at_home: {
      title: 'Advanced Training – At Home',
      description: "Advanced exercises in the pet's normal environment.",
      details: [
        'Advanced exercises in the pet\'s normal environment',
        'Progressive difficulty',
        'Focus and reliability',
        'Pet-parent coaching',
        'Home practice',
      ],
    },
    at_center: {
      title: 'Advanced Training – At Centre',
      description: 'Structured advanced training in a professional environment.',
      details: [
        'Structured advanced exercises',
        'Controlled distractions',
        'Progressive difficulty',
        'Focus and command reliability',
        'Pet-parent guidance',
      ],
    },
  }),
});
