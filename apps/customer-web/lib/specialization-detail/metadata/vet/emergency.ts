import { defineSpecialization } from '../../define';

export const emergencyMetadata = defineSpecialization({
  id: 'emergency',
  category: 'vet',
  title: 'Emergency Care',
  description:
    'Urgent veterinary attention for accidents, poisoning, breathing distress, seizures, and other life-threatening situations that cannot wait.',
  highlightChips: ['24/7 Availability', 'Rapid Response', 'Critical Care'],
  whatsIncluded: [
    { label: 'Triage Assessment', icon: 'shield' },
    { label: 'Stabilization', icon: 'heart' },
    { label: 'Diagnostic Imaging', icon: 'check' },
    { label: 'IV Fluids & Medication', icon: 'stethoscope' },
    { label: 'Surgical Intervention', icon: 'activity' },
    { label: 'Hospitalization', icon: 'home' },
  ],
  benefits: [
    { title: 'Life-Saving Care', description: 'Immediate treatment when every minute counts.', icon: 'shield' },
    { title: 'Rapid Diagnosis', description: 'On-site imaging and labs speed decisions.', icon: 'brain' },
    { title: 'Stabilization', description: 'Pain relief and support before transfer if needed.', icon: 'heart' },
    { title: 'Owner Communication', description: 'Clear updates during stressful moments.', icon: 'users' },
  ],
  whoIsThisFor: ['Trauma from accidents or falls', 'Suspected poisoning or toxin ingestion', 'Difficulty breathing or collapse'],
  timeline: [
    { period: 'Arrival', title: 'Immediate triage and stabilization' },
    { period: 'Diagnose', title: 'Tests and imaging as needed' },
    { period: 'Treat', title: 'Emergency procedure or hospitalization' },
    { period: 'Discharge', title: 'Recovery plan and follow-up vet' },
  ],
  tips: ['Call ahead so the clinic can prepare', 'Bring packaging if poisoning is suspected', 'Keep your pet warm and still during transport', 'Know your nearest 24-hour emergency clinic'],
});
