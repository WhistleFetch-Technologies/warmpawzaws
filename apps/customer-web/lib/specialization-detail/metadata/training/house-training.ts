import { defineSpecialization } from '../../define';

export const houseTrainingMetadata = defineSpecialization({
  id: 'house_training',
  aliases: ['potty_training'],
  category: 'training',
  title: 'House Training',
  description:
    'Establish dependable toilet habits through structured routines, positive reinforcement, and guidance tailored to your home layout and schedule.',
  highlightChips: ['Gentle Methods', 'Home Routines', 'Expert Guidance'],
  whatsIncluded: [
    { label: 'Schedule Planning', icon: 'calendar' },
    { label: 'Accident Prevention', icon: 'shield' },
    { label: 'Crate Guidance', icon: 'home' },
    { label: 'Positive Reinforcement', icon: 'heart' },
    { label: 'Night Routine', icon: 'clock' },
    { label: 'Follow-up Tips', icon: 'check' },
  ],
  benefits: [
    { title: 'Cleaner Home', description: 'Fewer accidents and less daily cleanup stress.', icon: 'home' },
    { title: 'Confident Puppy', description: 'Clear expectations help your pet feel secure.', icon: 'dog' },
    { title: 'Faster Progress', description: 'Structured steps accelerate reliable habits.', icon: 'zap' },
    { title: 'Long-term Success', description: 'Skills that carry through adolescence and beyond.', icon: 'star' },
  ],
  whoIsThisFor: ['New puppies', 'Rescue dogs adjusting to a new home', 'Apartment and indoor pets'],
  timeline: [
    { period: 'Week 1', title: 'Routine setup and supervised access' },
    { period: 'Week 2', title: 'Pattern recognition and timing cues' },
    { period: 'Week 3', title: 'Fewer accidents and growing confidence' },
    { period: 'Week 4', title: 'Reliable habits at home' },
  ],
  tips: ['Stick to consistent feeding times', 'Reward immediately after outdoor success', 'Limit unsupervised indoor access', 'Stay patient and consistent'],
});
