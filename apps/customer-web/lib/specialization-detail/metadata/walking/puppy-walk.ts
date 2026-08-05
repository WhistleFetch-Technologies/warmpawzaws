import { defineSpecialization } from '../../define';

export const puppyWalkMetadata = defineSpecialization({
  id: 'puppy_walk',
  category: 'walking',
  title: 'Puppy Walk',
  description:
    'Gentle, shorter walks designed for puppies with extra supervision, age-appropriate pacing, and positive early outdoor experiences.',
  highlightChips: ['Puppy-Safe Routes', 'Patient Walkers', 'Extra Supervision'],
  whatsIncluded: [
    { label: 'Short Distance Walks', icon: 'footprints' },
    { label: 'Socialization Moments', icon: 'users' },
    { label: 'Potty Breaks', icon: 'home' },
    { label: 'Gentle Pace', icon: 'heart' },
    { label: 'Safety Checks', icon: 'shield' },
    { label: 'Owner Updates', icon: 'check' },
  ],
  benefits: [
    { title: 'Safe Start', description: 'Age-appropriate exercise without overdoing it.', icon: 'shield' },
    { title: 'Early Social Skills', description: 'Positive exposure in controlled settings.', icon: 'users' },
    { title: 'Routine Building', description: 'Supports toilet and sleep schedules.', icon: 'calendar' },
    { title: 'Growing Confidence', description: 'Exploring the world feels fun, not scary.', icon: 'star' },
  ],
  whoIsThisFor: ['Puppies under 12 months', 'New pet parents', 'Post-vaccination pups ready for outdoors'],
  timeline: [
    { period: 'Session 1', title: 'Introduction and comfort check' },
    { period: 'Session 2', title: 'Short route with potty stops' },
    { period: 'Session 3', title: 'Gentle socialization moments' },
    { period: 'Ongoing', title: 'Regular puppy walks as they grow' },
  ],
  tips: ['Confirm vaccination status with your vet', 'Use a secure harness, not just a collar', 'Avoid hot pavement in summer', 'Keep first walks short and positive'],
});
