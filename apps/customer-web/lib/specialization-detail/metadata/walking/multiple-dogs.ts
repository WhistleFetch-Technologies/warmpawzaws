import { defineSpecialization } from '../../define';

export const multipleDogsMetadata = defineSpecialization({
  id: 'multiple_dogs',
  category: 'walking',
  title: 'Multiple Dogs Walk',
  description:
    'Coordinated walks for households with two or more dogs, handled by experienced walkers who manage leashes, pacing, and group dynamics safely.',
  highlightChips: ['Multi-Dog Expertise', 'Group Coordination', 'Safe Handling'],
  whatsIncluded: [
    { label: 'Multi-Leash Management', icon: 'footprints' },
    { label: 'Group Pace Matching', icon: 'activity' },
    { label: 'Individual Attention', icon: 'dog' },
    { label: 'Conflict Prevention', icon: 'shield' },
    { label: 'Route Planning', icon: 'mapPin' },
    { label: 'Walk Summary', icon: 'check' },
  ],
  benefits: [
    { title: 'One Booking, All Dogs', description: 'Simplify scheduling for multi-dog homes.', icon: 'calendar' },
    { title: 'Balanced Exercise', description: 'Each dog gets appropriate activity for their energy.', icon: 'activity' },
    { title: 'Safer Outings', description: 'Experienced handling of tangled leashes and reactivity.', icon: 'shield' },
    { title: 'Less Home Chaos', description: 'Tired dogs are calmer together indoors.', icon: 'heart' },
  ],
  whoIsThisFor: ['Two or more dogs in one household', 'Siblings who walk better together', 'Busy owners of multiple pets'],
  timeline: [
    { period: 'Session 1', title: 'Group meet-and-greet and dynamic assessment' },
    { period: 'Session 2', title: 'Leash setup and route trial' },
    { period: 'Session 3', title: 'Smooth group walking established' },
    { period: 'Ongoing', title: 'Regular multi-dog walks with updates' },
  ],
  tips: ['Use distinct harness colours for each dog', 'Share any inter-dog tension history', 'Ensure all dogs are vaccinated', 'Inform walker of individual medical needs'],
});
