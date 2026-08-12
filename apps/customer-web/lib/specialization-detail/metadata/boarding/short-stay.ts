import { defineSpecialization } from '../../define';

export const shortStayMetadata = defineSpecialization({
  id: 'short_stay',
  aliases: ['weekend_stay'],
  category: 'boarding',
  title: 'Overnight Boarding',
  description:
    'Comfortable overnight stays with attentive staff, regular meals, exercise, and a secure environment for weekend trips or short getaways.',
  highlightChips: ['Overnight Care', 'Secure Facilities', 'Daily Exercise'],
  whatsIncluded: [
    { label: 'Private Sleeping Area', icon: 'home' },
    { label: 'Scheduled Meals', icon: 'calendar' },
    { label: 'Exercise Sessions', icon: 'activity' },
    { label: 'Health Monitoring', icon: 'heart' },
    { label: 'Clean Bedding', icon: 'sparkles' },
    { label: 'Pickup Coordination', icon: 'check' },
  ],
  benefits: [
    { title: 'Home Away From Home', description: 'Structured care in a safe, familiar routine.', icon: 'home' },
    { title: 'Regular Activity', description: 'Walks and play keep your pet engaged.', icon: 'activity' },
    { title: 'Travel Freedom', description: 'Enjoy short trips without worrying.', icon: 'sun' },
    { title: 'Professional Oversight', description: 'Staff monitor appetite, mood, and comfort.', icon: 'shield' },
  ],
  whoIsThisFor: ['Weekend travellers', 'Overnight work trips', 'Home renovation or guest visits'],
  timeline: [
    { period: 'Drop-off', title: 'Check-in, settling, and meal schedule' },
    { period: 'Evening', title: 'Dinner, exercise, and rest' },
    { period: 'Morning', title: 'Breakfast, activity, and monitoring' },
    { period: 'Pickup', title: 'Reunion and handover notes' },
  ],
  tips: ['Bring vaccination records', 'Pack familiar blanket or toy', 'Share feeding and medication instructions', 'Book early for holiday weekends'],
});
