import { defineSpecialization } from '../../define';

export const fearPhobiaMetadata = defineSpecialization({
  id: 'fear_phobia',
  aliases: ['fear_n_phobia'],
  category: 'behavior',
  title: 'Fear & Phobia Support',
  description:
    'Support fearful pets with gradual exposure, counter-conditioning, and calm handling techniques for thunderstorms, strangers, vehicles, and more.',
  highlightChips: ['Gentle Approach', 'Fear-Free Methods', 'Personalized Plans'],
  whatsIncluded: [
    { label: 'Fear Assessment', icon: 'brain' },
    { label: 'Trigger Mapping', icon: 'target' },
    { label: 'Gradual Exposure', icon: 'shield' },
    { label: 'Calming Techniques', icon: 'heart' },
    { label: 'Safe Retreat Setup', icon: 'home' },
    { label: 'Owner Guidance', icon: 'graduation' },
  ],
  benefits: [
    { title: 'Reduced Panic', description: 'Pets learn coping skills instead of shutting down.', icon: 'heart' },
    { title: 'More Freedom', description: 'Walks and outings become less stressful.', icon: 'sun' },
    { title: 'Better Vet Visits', description: 'Less fear during exams and handling.', icon: 'stethoscope' },
    { title: 'Stronger Trust', description: 'Your pet learns you are a safe anchor.', icon: 'dog' },
  ],
  whoIsThisFor: ['Noise-phobic dogs', 'Rescue pets with trauma history', 'Pets afraid of strangers or handling'],
  timeline: [
    { period: 'Week 1', title: 'Fear inventory and safety planning' },
    { period: 'Week 2', title: 'Sub-threshold exposure exercises' },
    { period: 'Week 3', title: 'Positive associations with triggers' },
    { period: 'Week 4', title: 'Real-world confidence building' },
  ],
  tips: ['Never force your pet toward a fear trigger', 'Create a quiet safe space at home', 'Use high-value rewards generously', 'Discuss medication options with your vet if needed'],
});
