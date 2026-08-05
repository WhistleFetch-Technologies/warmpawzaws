import { defineSpecialization } from '../../define';

export const labDiagnosticsMetadata = defineSpecialization({
  id: 'lab_diagnostics',
  category: 'vet',
  title: 'Lab & Diagnostics',
  description:
    'Blood work, urinalysis, imaging referrals, and diagnostic testing to uncover health issues early and guide accurate treatment plans.',
  highlightChips: ['Accurate Testing', 'Licensed Labs', 'Fast Results'],
  whatsIncluded: [
    { label: 'Blood Panels', icon: 'stethoscope' },
    { label: 'Urinalysis', icon: 'check' },
    { label: 'Sample Collection', icon: 'heart' },
    { label: 'Imaging Referrals', icon: 'brain' },
    { label: 'Result Interpretation', icon: 'graduation' },
    { label: 'Follow-up Plan', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Early Detection', description: 'Catch kidney, liver, and thyroid issues before symptoms worsen.', icon: 'shield' },
    { title: 'Targeted Treatment', description: 'Results guide precise medication and care.', icon: 'stethoscope' },
    { title: 'Pre-Surgery Safety', description: 'Baseline labs reduce anaesthesia risks.', icon: 'check' },
    { title: 'Monitoring Progress', description: 'Track recovery and chronic conditions over time.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Annual wellness screening', 'Unexplained lethargy or weight change', 'Pre-operative assessments'],
  timeline: [
    { period: 'Consult', title: 'History review and test selection' },
    { period: 'Sample', title: 'Blood or urine collection' },
    { period: 'Analysis', title: 'Lab processing and review' },
    { period: 'Results', title: 'Vet explains findings and next steps' },
  ],
  tips: ['Fast your pet if instructed before blood work', 'Bring previous lab reports', 'Collect urine at home if asked', 'Ask when results will be ready'],
});
