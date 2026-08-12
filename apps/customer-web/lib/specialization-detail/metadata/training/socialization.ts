import { defineSpecialization } from '../../define';
import { trainingBenefits, trainingFeatures } from './training-content-helpers';
import { trainingServiceModes } from './training-service-mode-defaults';

export const socializationMetadata = defineSpecialization({
  id: 'socialization',
  category: 'training',
  title: 'Socialization',
  description:
    'Structured socialisation training designed to help pets become more comfortable and confident around people, animals and unfamiliar environments.',
  heroImage: '/images/home/Training/socialization-training.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Confidence Building', 'Social Skills', 'Controlled Exposure'],
  whatYouLearn: [
    'Appropriate interaction with people',
    'Appropriate interaction with other animals',
    'Confidence in unfamiliar environments',
    'Focus around distractions',
    'Emotional regulation',
    'Appropriate responses to new situations',
    'Calm behaviour during controlled interactions',
  ],
  whatsIncluded: trainingFeatures([
    'Behaviour assessment',
    'Trigger identification',
    'Controlled exposure where appropriate',
    'Positive reinforcement',
    'Desensitisation where appropriate',
    'Counter-conditioning where appropriate',
    'Pet-parent guidance',
    'Home practice exercises',
  ]),
  benefits: trainingBenefits([
    { title: 'Improved confidence', icon: 'star' },
    { title: 'Better social behaviour', icon: 'users' },
    { title: 'Better adaptability', icon: 'check' },
    { title: 'Improved response to unfamiliar situations', icon: 'brain' },
    { title: 'Better emotional regulation', icon: 'heart' },
  ]),
  whoIsThisFor: [
    'Puppies',
    'Dogs with socialisation difficulties',
    'Dogs uncomfortable around people',
    'Dogs uncomfortable around other animals',
    'Dogs needing confidence in unfamiliar environments',
  ],
  audienceTitle: 'Who Is This Training For?',
  timeline: [],
  tips: [],
  importantNotes: [
    'Socialisation training uses safe, controlled and appropriate exposure techniques.',
    'It does not promise that socialisation will eliminate fear or aggression.',
  ],
  serviceModeInformation: trainingServiceModes({
    at_home: {
      title: 'Socialization – At Home',
      description: 'Training focused on interactions in familiar surroundings.',
      details: [
        'Observe interactions in familiar surroundings',
        'Understand household triggers',
        'Work on appropriate responses',
        'Guide pet-parent interactions',
        'Continue exercises at home',
      ],
    },
    at_center: {
      title: 'Socialization – At Centre',
      description: 'Structured socialisation in a professional environment.',
      details: [
        'Controlled interaction',
        'Structured exposure',
        'Confidence-building exercises',
        'Appropriate interaction with people/animals where suitable',
        'Practice around unfamiliar environments',
        'Pet-parent guidance',
      ],
    },
  }),
});
