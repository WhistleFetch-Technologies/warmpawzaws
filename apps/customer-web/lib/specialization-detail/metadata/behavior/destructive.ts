import { defineSpecialization } from '../../define';

export const destructiveMetadata = defineSpecialization({
  id: 'destructive',
  aliases: ['destructive_behavior', 'destructive_behaviour'],
  category: 'behavior',
  title: 'Destructive Behaviour',
  description:
    'Address chewing, digging, and household damage by tackling boredom, anxiety, and unmet needs with structured enrichment and training.',
  highlightChips: ['Root Cause Analysis', 'Enrichment Plans', 'Home Management'],
  whatsIncluded: [
    { label: 'Behaviour Assessment', icon: 'brain' },
    { label: 'Enrichment Schedule', icon: 'dog' },
    { label: 'Chew Alternatives', icon: 'check' },
    { label: 'Supervision Protocols', icon: 'shield' },
    { label: 'Anxiety Screening', icon: 'heart' },
    { label: 'Progress Reviews', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Protected Belongings', description: 'Fewer damaged shoes, furniture, and doors.', icon: 'home' },
    { title: 'Mental Stimulation', description: 'A tired mind chews less out of boredom.', icon: 'brain' },
    { title: 'Safer Home', description: 'Reduced risk from swallowed objects or wires.', icon: 'shield' },
    { title: 'Calmer Pet', description: 'Structured outlets replace frantic destruction.', icon: 'heart' },
  ],
  whoIsThisFor: ['Puppies in teething phase', 'High-energy breeds left alone', 'Anxious chewers and diggers'],
  timeline: [
    { period: 'Week 1', title: 'Damage log and trigger identification' },
    { period: 'Week 2', title: 'Enrichment and confinement strategy' },
    { period: 'Week 3', title: 'Training alternatives to destruction' },
    { period: 'Week 4', title: 'Unsupervised time with safeguards' },
  ],
  tips: ['Puppy-proof or dog-proof one room at a time', 'Rotate chew toys to maintain interest', 'Exercise before leaving your pet alone', 'Never punish after the fact'],
});
