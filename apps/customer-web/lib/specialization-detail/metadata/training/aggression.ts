import { defineSpecialization } from '../../define';

export const aggressionMetadata = defineSpecialization({
  id: 'aggression',
  aliases: ['aggression_fix', 'agression_fix'],
  category: 'training',
  title: 'Aggression Training',
  description:
    'Address reactive or aggressive behaviour with safety-first assessment, structured desensitization, and practical management plans for your home.',
  highlightChips: ['Safety First', 'Certified Experts', 'Behaviour Plans'],
  whatsIncluded: [
    { label: 'Behaviour Assessment', icon: 'brain' },
    { label: 'Trigger Management', icon: 'shield' },
    { label: 'Desensitization', icon: 'target' },
    { label: 'Alternative Behaviours', icon: 'check' },
    { label: 'Owner Handling Skills', icon: 'graduation' },
    { label: 'Progress Tracking', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Safer Home', description: 'Clear protocols reduce risk for family and visitors.', icon: 'shield' },
    { title: 'Less Reactivity', description: 'Calmer responses develop gradually over time.', icon: 'heart' },
    { title: 'Informed Owners', description: 'You learn what to do in everyday situations.', icon: 'graduation' },
    { title: 'Better Quality of Life', description: 'More peaceful routines for everyone at home.', icon: 'sun' },
  ],
  whoIsThisFor: ['Dogs showing reactivity on walks', 'Pets with resource guarding concerns', 'Fear-based aggression cases'],
  timeline: [
    { period: 'Week 1', title: 'Safety assessment and trigger mapping' },
    { period: 'Week 2', title: 'Management tools and calm alternatives' },
    { period: 'Week 3', title: 'Controlled desensitization exercises' },
    { period: 'Week 4', title: 'Real-world practice with support' },
  ],
  tips: ['Never punish growling or warning signals', 'Use a muzzle if your trainer advises', 'Share any bite history honestly', 'Keep sessions predictable and low-stress'],
});
