import { defineSpecialization } from '../../define';

export const specialDietMetadata = defineSpecialization({
  id: 'special_diet',
  aliases: ['prescription_diet', 'medical_diet'],
  category: 'nutrition',
  title: 'Prescription Diet',
  description:
    'Vet-coordinated therapeutic diets for kidney disease, diabetes, urinary issues, and other medical conditions requiring precise nutritional control.',
  highlightChips: ['Vet-Coordinated', 'Therapeutic Formulas', 'Condition-Specific'],
  whatsIncluded: [
    { label: 'Medical History Review', icon: 'stethoscope' },
    { label: 'Prescription Diet Selection', icon: 'check' },
    { label: 'Vet Alignment', icon: 'shield' },
    { label: 'Transition Schedule', icon: 'calendar' },
    { label: 'Monitoring Plan', icon: 'heart' },
    { label: 'Compliance Support', icon: 'graduation' },
  ],
  benefits: [
    { title: 'Disease Management', description: 'Nutrition supports kidney, liver, and urinary health.', icon: 'shield' },
    { title: 'Vet-Approved', description: 'Plans align with your veterinarian\'s treatment.', icon: 'stethoscope' },
    { title: 'Stable Condition', description: 'Consistent diet reduces flare-ups.', icon: 'heart' },
    { title: 'Clear Instructions', description: 'No guesswork on what to feed and when.', icon: 'graduation' },
  ],
  whoIsThisFor: ['Pets on vet-prescribed therapeutic food', 'Kidney, liver, or urinary conditions', 'Diabetes requiring strict feeding times'],
  timeline: [
    { period: 'Consult', title: 'Review diagnosis and current diet' },
    { period: 'Select', title: 'Choose appropriate prescription formula' },
    { period: 'Transition', title: 'Gradual switch over 7–10 days' },
    { period: 'Monitor', title: 'Track symptoms and lab values with vet' },
  ],
  tips: ['Do not mix prescription food with regular kibble', 'Buy from authorized sources only', 'Share lab results with your nutritionist', 'Never stop a medical diet without vet approval'],
});
