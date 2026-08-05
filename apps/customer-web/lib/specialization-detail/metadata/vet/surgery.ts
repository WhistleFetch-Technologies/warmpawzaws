import { defineSpecialization } from '../../define';

export const surgeryMetadata = defineSpecialization({
  id: 'surgery',
  category: 'vet',
  title: 'Surgery',
  description:
    'Planned surgical procedures from spay/neuter to soft-tissue and orthopaedic operations—with pre-op assessment, anaesthesia monitoring, and recovery guidance.',
  highlightChips: ['Licensed Surgeons', 'Safe Anaesthesia', 'Recovery Support'],
  whatsIncluded: [
    { label: 'Pre-Op Assessment', icon: 'stethoscope' },
    { label: 'Anaesthesia Protocol', icon: 'shield' },
    { label: 'Surgical Procedure', icon: 'check' },
    { label: 'Post-Op Monitoring', icon: 'heart' },
    { label: 'Pain Management', icon: 'calendar' },
    { label: 'Discharge Instructions', icon: 'home' },
  ],
  benefits: [
    { title: 'Expert Hands', description: 'Experienced surgeons and monitored anaesthesia.', icon: 'shield' },
    { title: 'Pain Control', description: 'Multi-modal relief during and after surgery.', icon: 'heart' },
    { title: 'Clear Recovery Plan', description: 'Written instructions for home care.', icon: 'graduation' },
    { title: 'Health Outcomes', description: 'Corrective surgery restores mobility and wellness.', icon: 'activity' },
  ],
  whoIsThisFor: ['Spay and neuter procedures', 'Tumour removal and biopsies', 'Orthopaedic and soft-tissue operations'],
  timeline: [
    { period: 'Pre-op', title: 'Exam, fasting, and lab work' },
    { period: 'Surgery', title: 'Procedure under monitored anaesthesia' },
    { period: 'Recovery', title: 'Wake-up and hospital observation' },
    { period: 'Home', title: 'Rest, meds, and suture check date' },
  ],
  tips: ['Follow fasting instructions strictly', 'Restrict activity as directed after surgery', 'Prevent licking at incision site', 'Attend suture removal on schedule'],
});
