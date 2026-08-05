import { defineSpecialization } from '../../define';

export const weightManagementMetadata = defineSpecialization({
  id: 'weight_management',
  aliases: ['weight_loss', 'weight_measurement'],
  category: 'nutrition',
  title: 'Weight Management',
  description:
    'Structured weight-loss or maintenance programs with calorie targets, portion control, and exercise guidance to help overweight pets reach a healthy size safely.',
  highlightChips: ['Calorie Control', 'Safe Weight Loss', 'Progress Tracking'],
  whatsIncluded: [
    { label: 'Body Condition Score', icon: 'activity' },
    { label: 'Calorie Target Plan', icon: 'calendar' },
    { label: 'Portion Measurements', icon: 'check' },
    { label: 'Treat Budget', icon: 'heart' },
    { label: 'Exercise Recommendations', icon: 'footprints' },
    { label: 'Weekly Weigh-ins', icon: 'star' },
  ],
  benefits: [
    { title: 'Healthier Joints', description: 'Less weight means less strain on hips and knees.', icon: 'shield' },
    { title: 'More Energy', description: 'Lean pets often become more active and playful.', icon: 'zap' },
    { title: 'Longer Life', description: 'Healthy weight linked to increased lifespan.', icon: 'heart' },
    { title: 'Measurable Progress', description: 'Structured tracking keeps you on course.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Overweight or obese pets', 'Breeds prone to weight gain', 'Post-neuter weight creep'],
  timeline: [
    { period: 'Week 1', title: 'Weigh-in and calorie baseline' },
    { period: 'Week 2', title: 'Reduced-calorie plan starts' },
    { period: 'Week 4', title: 'First progress weigh-in' },
    { period: 'Month 2+', title: 'Adjust until target weight reached' },
  ],
  tips: ['Measure food with a scale, not a scoop', 'Account for all treats in daily calories', 'Increase activity gradually', 'Never crash-diet—slow loss is safest'],
});
