import { defineSpecialization } from '../../define';

export const socializationMetadata = defineSpecialization({
  id: 'socialization',
  category: 'training',
  title: 'Socialization',
  description:
    'Help your pet build confidence with people, animals, sounds, and new environments through safe, guided exposure at the right pace.',
  highlightChips: ['Safe Exposure', 'Confidence Building', 'Guided Sessions'],
  whatsIncluded: [
    { label: 'People Greetings', icon: 'users' },
    { label: 'Pet Interactions', icon: 'dog' },
    { label: 'New Environments', icon: 'mapPin' },
    { label: 'Sound Desensitization', icon: 'brain' },
    { label: 'Body Handling', icon: 'check' },
    { label: 'Owner Coaching', icon: 'graduation' },
  ],
  benefits: [
    { title: 'Less Fear', description: 'New situations feel manageable instead of overwhelming.', icon: 'heart' },
    { title: 'Better Manners', description: 'Polite behaviour around guests and other dogs.', icon: 'award' },
    { title: 'Vet & Groom Ready', description: 'Easier handling during appointments and grooming.', icon: 'stethoscope' },
    { title: 'Happy Explorer', description: 'More places you can visit together with confidence.', icon: 'sun' },
  ],
  whoIsThisFor: ['Puppies in the critical socialization window', 'Shy rescue dogs', 'Under-socialized adult pets'],
  timeline: [
    { period: 'Week 1', title: 'Baseline assessment and gentle introductions' },
    { period: 'Week 2', title: 'Controlled exposure to people and environments' },
    { period: 'Week 3', title: 'Structured pet interactions and handling' },
    { period: 'Week 4', title: 'Real-world social skills in daily outings' },
  ],
  tips: ['Go at your pet\'s pace', 'Watch body language closely', 'Avoid overwhelming outings', 'Reward calm, curious behaviour'],
});
