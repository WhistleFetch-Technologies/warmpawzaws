import { defineSpecialization } from '../../define';

export const advancedTrainingMetadata = defineSpecialization({
  id: 'advanced_training',
  aliases: ['advanced_skills'],
  category: 'training',
  title: 'Advanced Training',
  description:
    'Take your dog beyond basics with advanced commands, off-leash reliability, and real-world performance in stimulating environments.',
  highlightChips: ['Expert Trainers', 'Advanced Skills', 'Real-World Reliability'],
  whatsIncluded: [
    { label: 'Advanced Commands', icon: 'graduation' },
    { label: 'Behaviour Refinement', icon: 'brain' },
    { label: 'Recall Training', icon: 'target' },
    { label: 'Confidence Building', icon: 'award' },
    { label: 'Social Skills', icon: 'users' },
    { label: 'Ongoing Support', icon: 'heart' },
  ],
  benefits: [
    { title: 'Better Behaviour', description: 'Calmer responses in parks, crowds, and busy settings.', icon: 'check' },
    { title: 'Stronger Bond', description: 'Shared training builds trust and teamwork.', icon: 'heart' },
    { title: 'More Freedom', description: 'Enjoy walks and outings with greater confidence.', icon: 'sun' },
    { title: 'Life-long Skills', description: 'Habits that stay with your pet for years.', icon: 'trophy' },
  ],
  whoIsThisFor: ['Dogs who mastered basic obedience', 'High-energy breeds needing mental challenge', 'Owners seeking off-leash reliability'],
  timeline: [
    { period: 'Week 1', title: 'Assessment and advanced command foundations' },
    { period: 'Week 2', title: 'Distraction training and impulse control' },
    { period: 'Week 3', title: 'Confidence building in real settings' },
    { period: 'Week 4', title: 'Advanced skills integrated into daily life' },
  ],
  tips: ['Bring favourite high-value treats', 'Keep vaccination records updated', 'Always carry a leash as backup', 'Inform trainer of any medical conditions'],
});
