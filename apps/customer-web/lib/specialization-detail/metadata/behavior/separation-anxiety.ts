import { defineSpecialization } from '../../define';

export const separationAnxietyMetadata = defineSpecialization({
  id: 'separation_anxiety',
  aliases: ['separation'],
  category: 'behavior',
  title: 'Separation Anxiety',
  description:
    'Help your pet feel secure when alone through gradual desensitization, calming routines, and strategies that reduce distress and destructive behaviour.',
  highlightChips: ['Calm Departures', 'Gradual Plans', 'Compassionate Care'],
  whatsIncluded: [
    { label: 'Anxiety Assessment', icon: 'brain' },
    { label: 'Departure Protocols', icon: 'home' },
    { label: 'Calming Routines', icon: 'heart' },
    { label: 'Alone-Time Training', icon: 'clock' },
    { label: 'Environment Setup', icon: 'shield' },
    { label: 'Progress Monitoring', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Calmer Alone Time', description: 'Your pet learns that departures are safe and temporary.', icon: 'heart' },
    { title: 'Less Destruction', description: 'Reduced chewing, scratching, and escape attempts.', icon: 'shield' },
    { title: 'Better Sleep', description: 'Quieter nights for neighbours and your household.', icon: 'clock' },
    { title: 'Confident Pet', description: 'Independence builds without fear or panic.', icon: 'dog' },
  ],
  whoIsThisFor: ['Dogs who panic when left alone', 'Pets with post-adoption anxiety', 'Households with neighbour noise complaints'],
  timeline: [
    { period: 'Week 1', title: 'Trigger assessment and baseline recording' },
    { period: 'Week 2', title: 'Micro-departures and calm associations' },
    { period: 'Week 3', title: 'Extended alone-time practice' },
    { period: 'Week 4', title: 'Real-world departures with support' },
  ],
  tips: ['Avoid dramatic hellos and goodbyes', 'Provide enrichment before leaving', 'Use a camera to track progress', 'Consult your vet if anxiety is severe'],
});
