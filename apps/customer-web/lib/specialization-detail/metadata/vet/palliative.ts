import { defineSpecialization } from '../../define';

export const palliativeMetadata = defineSpecialization({
  id: 'palliative',
  category: 'vet',
  title: 'Palliative Care',
  description:
    'Compassionate comfort-focused care for pets with serious or terminal illness—managing pain, nausea, and quality of life with dignity.',
  highlightChips: ['Comfort Focus', 'Pain Management', 'Compassionate Support'],
  whatsIncluded: [
    { label: 'Pain Assessment', icon: 'heart' },
    { label: 'Medication Adjustment', icon: 'stethoscope' },
    { label: 'Comfort Planning', icon: 'home' },
    { label: 'Nutrition Support', icon: 'leaf' },
    { label: 'Mobility Aids Advice', icon: 'activity' },
    { label: 'Family Counselling', icon: 'users' },
  ],
  benefits: [
    { title: 'Reduced Suffering', description: 'Pain and discomfort managed proactively.', icon: 'heart' },
    { title: 'Quality Time', description: 'Focus on comfort and meaningful moments together.', icon: 'sun' },
    { title: 'Informed Decisions', description: 'Clear guidance on care options and timing.', icon: 'graduation' },
    { title: 'Home Comfort', description: 'Plans tailored to your pet\'s familiar environment.', icon: 'home' },
  ],
  whoIsThisFor: ['Senior pets with chronic illness', 'Cancer and terminal diagnoses', 'Families navigating end-of-life care'],
  timeline: [
    { period: 'Assessment', title: 'Quality-of-life evaluation' },
    { period: 'Plan', title: 'Comfort medications and home adjustments' },
    { period: 'Monitor', title: 'Regular check-ins and dose tuning' },
    { period: 'Support', title: 'Ongoing guidance for changing needs' },
  ],
  tips: ['Track good and bad days in a journal', 'Discuss mobility and appetite changes openly', 'Prepare a quiet, accessible resting area', 'Ask about hospice and at-home vet options'],
});
