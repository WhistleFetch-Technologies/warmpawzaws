import { defineSpecialization } from '../../define';

export const neurologyMetadata = defineSpecialization({
  id: 'neurology',
  category: 'vet',
  title: 'Neurology',
  description:
    'Specialized care for seizures, spinal issues, weakness, balance problems, and nerve disorders—with neurological exams and advanced diagnostics.',
  highlightChips: ['Neuro Specialists', 'Seizure Management', 'Spinal Care'],
  whatsIncluded: [
    { label: 'Neurological Exam', icon: 'brain' },
    { label: 'MRI/CT Referral', icon: 'check' },
    { label: 'Seizure Protocol', icon: 'shield' },
    { label: 'Spinal Assessment', icon: 'stethoscope' },
    { label: 'Medication Management', icon: 'calendar' },
    { label: 'Rehab Referral', icon: 'activity' },
  ],
  benefits: [
    { title: 'Seizure Control', description: 'Medication plans reduce frequency and severity.', icon: 'shield' },
    { title: 'Spinal Diagnosis', description: 'Identify disc disease and compression early.', icon: 'brain' },
    { title: 'Mobility Support', description: 'Rehab and aids for weak or paralyzed limbs.', icon: 'activity' },
    { title: 'Quality of Life', description: 'Manage chronic neuro conditions with dignity.', icon: 'heart' },
  ],
  whoIsThisFor: ['Recurrent seizures', 'Sudden hind leg weakness', 'Head tilt, circling, or balance loss'],
  timeline: [
    { period: 'Consult', title: 'Detailed neuro examination' },
    { period: 'Diagnose', title: 'Imaging or CSF analysis if indicated' },
    { period: 'Treat', title: 'Medication or surgical referral' },
    { period: 'Monitor', title: 'Seizure log review and dose tuning' },
  ],
  tips: ['Video-record seizures to show your vet', 'Keep a seizure diary with dates and duration', 'Do not put hands near mouth during a seizure', 'Seek emergency care for cluster seizures'],
});
