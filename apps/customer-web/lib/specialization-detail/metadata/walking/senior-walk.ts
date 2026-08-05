import { defineSpecialization } from '../../define';

export const seniorWalkMetadata = defineSpecialization({
  id: 'senior_walk',
  category: 'walking',
  title: 'Senior Walk',
  description:
    'Slow, supportive walks tailored to senior dogs with joint-aware routes, frequent rest breaks, and walkers trained for mobility limitations.',
  highlightChips: ['Gentle Pace', 'Joint-Aware Routes', 'Caring Walkers'],
  whatsIncluded: [
    { label: 'Slow-Paced Walks', icon: 'footprints' },
    { label: 'Rest Breaks', icon: 'clock' },
    { label: 'Flat Safe Routes', icon: 'mapPin' },
    { label: 'Mobility Support', icon: 'heart' },
    { label: 'Temperature Awareness', icon: 'sun' },
    { label: 'Health Notes', icon: 'check' },
  ],
  benefits: [
    { title: 'Comfortable Movement', description: 'Exercise without strain on aging joints.', icon: 'heart' },
    { title: 'Mental Stimulation', description: 'Sniff walks keep senior minds engaged.', icon: 'brain' },
    { title: 'Weight Support', description: 'Gentle activity helps maintain mobility.', icon: 'activity' },
    { title: 'Trusted Care', description: 'Walkers attentive to senior-specific needs.', icon: 'shield' },
  ],
  whoIsThisFor: ['Senior dogs slowing down', 'Pets with arthritis or hip issues', 'Post-surgery recovery walks (vet cleared)'],
  timeline: [
    { period: 'Session 1', title: 'Mobility assessment and route selection' },
    { period: 'Session 2', title: 'Gentle pace with rest stops' },
    { period: 'Session 3', title: 'Comfortable senior routine' },
    { period: 'Ongoing', title: 'Regular supportive walks with notes' },
  ],
  tips: ['Share mobility limitations and medications', 'Bring any support harness your vet recommends', 'Avoid peak heat hours', 'Keep your vet\'s advice handy for activity limits'],
});
