import { defineSpecialization } from '../../define';

export const resourceGuardingMetadata = defineSpecialization({
  id: 'resource_guarding',
  aliases: ['possessive_behavior', 'possessive_behaviour'],
  category: 'behavior',
  title: 'Resource Guarding',
  description:
    'Reduce possessive behaviour around food, toys, and spaces using trade-up games, safe handling protocols, and family-wide consistency.',
  highlightChips: ['Safety Protocols', 'Trade-Up Training', 'Family Coaching'],
  whatsIncluded: [
    { label: 'Guard Assessment', icon: 'brain' },
    { label: 'Trade-Up Exercises', icon: 'target' },
    { label: 'Feeding Protocols', icon: 'heart' },
    { label: 'Space Management', icon: 'home' },
    { label: 'Child & Guest Safety', icon: 'shield' },
    { label: 'Progress Tracking', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Safer Interactions', description: 'Lower tension around food bowls and favourite items.', icon: 'shield' },
    { title: 'Family Confidence', description: 'Everyone learns safe approaches and boundaries.', icon: 'users' },
    { title: 'Less Conflict', description: 'Reduced growling and snapping over possessions.', icon: 'heart' },
    { title: 'Trust Building', description: 'Your pet learns giving up items leads to good things.', icon: 'dog' },
  ],
  whoIsThisFor: ['Dogs guarding food or treats', 'Multi-pet households with tension', 'Families with young children'],
  timeline: [
    { period: 'Week 1', title: 'Safety assessment and management setup' },
    { period: 'Week 2', title: 'Trade-up and drop-it foundations' },
    { period: 'Week 3', title: 'Approach and handling exercises' },
    { period: 'Week 4', title: 'Real-life scenarios with supervision' },
  ],
  tips: ['Never pry items from your dog\'s mouth', 'Feed separately in multi-dog homes initially', 'Use high-value trades, not punishment', 'Inform all household members of protocols'],
});
