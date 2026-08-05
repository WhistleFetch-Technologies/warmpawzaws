import { defineSpecialization } from '../../define';

export const dailyWalkMetadata = defineSpecialization({
  id: 'daily_walk',
  category: 'walking',
  title: 'Daily Walk',
  description:
    'Reliable daily exercise with verified walkers who keep your pet active, engaged, and safely returned with walk updates you can trust.',
  highlightChips: ['Verified Walkers', 'GPS Tracked', 'Flexible Slots'],
  whatsIncluded: [
    { label: 'Scheduled Walks', icon: 'calendar' },
    { label: 'Exercise & Stretch', icon: 'activity' },
    { label: 'Hydration Breaks', icon: 'heart' },
    { label: 'Walk Updates', icon: 'check' },
    { label: 'Safe Routes', icon: 'mapPin' },
    { label: 'Post-walk Notes', icon: 'star' },
  ],
  benefits: [
    { title: 'Healthy Routine', description: 'Regular movement supports weight and mood.', icon: 'activity' },
    { title: 'Less Boredom', description: 'Burns energy that might otherwise become mischief.', icon: 'zap' },
    { title: 'Peace of Mind', description: 'Trusted walkers when your schedule is packed.', icon: 'shield' },
    { title: 'Happy Dog', description: 'Sniffing and exploring reduce daily stress.', icon: 'dog' },
  ],
  whoIsThisFor: ['Busy pet parents', 'High-energy breeds', 'Apartment dogs needing regular outings'],
  timeline: [
    { period: 'Session 1', title: 'Meet-and-greet with your walker' },
    { period: 'Session 2', title: 'Route planning and safety check' },
    { period: 'Session 3', title: 'Comfortable routine established' },
    { period: 'Ongoing', title: 'Regular daily walks with updates' },
  ],
  tips: ['Share gate and access instructions', 'Keep collar ID tags current', 'Note any medical alerts', 'Leave a water bowl ready after walks'],
});
