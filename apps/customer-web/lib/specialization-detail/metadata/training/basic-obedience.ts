import { defineSpecialization } from '../../define';

export const basicObedienceMetadata = defineSpecialization({
  id: 'basic_obedience',
  category: 'training',
  title: 'Basic Obedience',
  description:
    'Build a reliable foundation with sit, stay, recall, and polite manners that work at home, on walks, and when guests visit.',
  highlightChips: ['Foundation Skills', 'Positive Methods', 'All Breeds Welcome'],
  whatsIncluded: [
    { label: 'Sit & Stay', icon: 'check' },
    { label: 'Recall Basics', icon: 'target' },
    { label: 'Leash Manners', icon: 'footprints' },
    { label: 'Impulse Control', icon: 'brain' },
    { label: 'Home Practice Plan', icon: 'home' },
    { label: 'Progress Reviews', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Safer Outings', description: 'Better control in parks and on busy streets.', icon: 'shield' },
    { title: 'Less Stress', description: 'Clear cues reduce confusion for your pet.', icon: 'heart' },
    { title: 'Family Friendly', description: 'Everyone in the household can use the same commands.', icon: 'users' },
    { title: 'Ready to Grow', description: 'A solid base for advanced training later.', icon: 'graduation' },
  ],
  whoIsThisFor: ['Puppies and adolescents', 'First-time pet parents', 'Dogs needing a manners refresh'],
  timeline: [
    { period: 'Week 1', title: 'Assessment and core command introduction' },
    { period: 'Week 2', title: 'Consistency drills and distraction basics' },
    { period: 'Week 3', title: 'Real-world practice in controlled settings' },
    { period: 'Week 4', title: 'Obedience skills integrated into daily life' },
  ],
  tips: ['Practice in short daily sessions', 'Use high-value treats', 'Keep training fun and upbeat', 'Share household rules with family'],
});
