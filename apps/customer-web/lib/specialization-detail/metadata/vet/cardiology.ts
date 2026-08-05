import { defineSpecialization } from '../../define';

export const cardiologyMetadata = defineSpecialization({
  id: 'cardiology',
  category: 'vet',
  title: 'Heart Care',
  description:
    'Cardiac evaluation for murmurs, coughing, exercise intolerance, and heart disease—with ECG, echocardiography, and long-term management plans.',
  highlightChips: ['Heart Specialists', 'Advanced Imaging', 'Long-term Management'],
  whatsIncluded: [
    { label: 'Cardiac Auscultation', icon: 'stethoscope' },
    { label: 'ECG & Echo', icon: 'check' },
    { label: 'Blood Pressure Check', icon: 'heart' },
    { label: 'Medication Plan', icon: 'calendar' },
    { label: 'Exercise Guidance', icon: 'activity' },
    { label: 'Monitoring Schedule', icon: 'clock' },
  ],
  benefits: [
    { title: 'Early Diagnosis', description: 'Detect murmurs and arrhythmias before crisis.', icon: 'shield' },
    { title: 'Better Quality of Life', description: 'Medications reduce coughing and fatigue.', icon: 'heart' },
    { title: 'Tailored Activity', description: 'Safe exercise levels for heart conditions.', icon: 'activity' },
    { title: 'Proactive Monitoring', description: 'Regular checks track disease progression.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Heart murmur detected on exam', 'Coughing especially at night', 'Senior breeds prone to heart disease'],
  timeline: [
    { period: 'Consult', title: 'History and cardiac exam' },
    { period: 'Diagnose', title: 'ECG, echo, or chest imaging' },
    { period: 'Treat', title: 'Medication and lifestyle plan' },
    { period: 'Monitor', title: 'Ongoing rechecks and dose adjustment' },
  ],
  tips: ['Monitor resting respiratory rate at home', 'Report increased coughing promptly', 'Keep sodium-restricted diet if prescribed', 'Avoid strenuous exercise until cleared'],
});
