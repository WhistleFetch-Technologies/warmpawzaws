import { defineSpecialization } from '../../define';

export const leashWalkingMetadata = defineSpecialization({
  id: 'leash_walking',
  aliases: ['leash_training'],
  category: 'training',
  title: 'Leash Walking',
  description:
    'Transform stressful walks into relaxed outings with loose-leash skills, calm responses to distractions, and confident street manners.',
  highlightChips: ['Calm Walks', 'Distraction Training', 'Outdoor Confidence'],
  whatsIncluded: [
    { label: 'Loose Leash Walking', icon: 'footprints' },
    { label: 'Stop Pulling', icon: 'target' },
    { label: 'Distraction Control', icon: 'brain' },
    { label: 'Road Safety Skills', icon: 'shield' },
    { label: 'Equipment Guidance', icon: 'check' },
    { label: 'Practice Routes', icon: 'mapPin' },
  ],
  benefits: [
    { title: 'Enjoyable Walks', description: 'Less pulling means more quality time together.', icon: 'heart' },
    { title: 'Safer Streets', description: 'Better control near traffic, cyclists, and other dogs.', icon: 'shield' },
    { title: 'Less Fatigue', description: 'Easier on your arms, shoulders, and back.', icon: 'activity' },
    { title: 'Social Ready', description: 'Calmer passes by people, pets, and busy areas.', icon: 'users' },
  ],
  whoIsThisFor: ['Strong pullers', 'Reactive or excitable walkers', 'Puppies learning outdoor etiquette'],
  timeline: [
    { period: 'Week 1', title: 'Equipment check and leash pressure basics' },
    { period: 'Week 2', title: 'Loose-leash drills in quiet areas' },
    { period: 'Week 3', title: 'Distraction training on familiar routes' },
    { period: 'Week 4', title: 'Confident walks in everyday settings' },
  ],
  tips: ['Use a well-fitted harness', 'Bring treats for positive reinforcement', 'Start in low-traffic areas', 'Walk before meals when possible'],
});
