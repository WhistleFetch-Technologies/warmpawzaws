import { defineSpecialization } from '../../define';

export const daycareMetadata = defineSpecialization({
  id: 'daycare',
  category: 'boarding',
  title: 'Day Boarding',
  description:
    'Safe, supervised daytime care with structured play, rest periods, and social time while you work or handle errands—your pet returns home happy and tired.',
  highlightChips: ['Supervised Play', 'Safe Environment', 'Daily Updates'],
  whatsIncluded: [
    { label: 'Supervised Playtime', icon: 'users' },
    { label: 'Rest Periods', icon: 'clock' },
    { label: 'Feeding Support', icon: 'heart' },
    { label: 'Clean Facilities', icon: 'sparkles' },
    { label: 'Social Groups', icon: 'dog' },
    { label: 'Pickup Ready', icon: 'check' },
  ],
  benefits: [
    { title: 'Healthy Socialization', description: 'Supervised interaction with compatible pets.', icon: 'users' },
    { title: 'Energy Outlet', description: 'Less boredom and destructive behaviour at home.', icon: 'zap' },
    { title: 'Structured Day', description: 'Routine while you are at work.', icon: 'calendar' },
    { title: 'Peace of Mind', description: 'Trusted staff in secure, clean premises.', icon: 'shield' },
  ],
  whoIsThisFor: ['Working pet parents', 'Social, friendly dogs', 'Puppies needing daytime supervision'],
  timeline: [
    { period: 'Morning', title: 'Check-in and calm introduction' },
    { period: 'Midday', title: 'Play, rest, and feeding' },
    { period: 'Afternoon', title: 'Activities and supervision' },
    { period: 'Pickup', title: 'Happy, tired pet ready to go home' },
  ],
  tips: ['Share feeding instructions and allergies', 'Ensure vaccinations are current', 'Trial a half-day first if your pet is anxious', 'Pack a favourite toy optionally'],
});
