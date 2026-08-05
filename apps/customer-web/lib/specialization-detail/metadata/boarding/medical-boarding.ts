import { defineSpecialization } from '../../define';

export const medicalBoardingMetadata = defineSpecialization({
  id: 'medical_boarding',
  category: 'boarding',
  title: 'Medical Boarding',
  description:
    'Supervised boarding for pets recovering from illness, surgery, or chronic conditions—with medication administration and health monitoring by trained staff.',
  highlightChips: ['Medication Support', 'Health Monitoring', 'Vet-Linked Care'],
  whatsIncluded: [
    { label: 'Medication Administration', icon: 'stethoscope' },
    { label: 'Vital Monitoring', icon: 'heart' },
    { label: 'Restricted Activity', icon: 'shield' },
    { label: 'Special Diet Support', icon: 'calendar' },
    { label: 'Vet Coordination', icon: 'check' },
    { label: 'Recovery Updates', icon: 'star' },
  ],
  benefits: [
    { title: 'Safe Recovery', description: 'Staff follow vet instructions precisely.', icon: 'shield' },
    { title: 'Medication Compliance', description: 'Doses given on schedule when you cannot.', icon: 'stethoscope' },
    { title: 'Early Detection', description: 'Changes in appetite or behaviour are flagged quickly.', icon: 'heart' },
    { title: 'Owner Relief', description: 'Travel or work without compromising post-care.', icon: 'home' },
  ],
  whoIsThisFor: ['Post-surgery recovery pets', 'Chronic conditions needing daily meds', 'Elderly pets requiring close monitoring'],
  timeline: [
    { period: 'Intake', title: 'Medical history and care plan review' },
    { period: 'Daily', title: 'Meds, monitoring, and restricted rest' },
    { period: 'Mid-stay', title: 'Progress check and vet update if needed' },
    { period: 'Discharge', title: 'Handover with care notes' },
  ],
  tips: ['Get written instructions from your vet', 'Bring all medications in original packaging', 'Share emergency vet contact', 'Confirm facility can handle your pet\'s specific needs'],
});
