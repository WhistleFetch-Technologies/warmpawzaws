import { defineSpecialization } from '../../define';

export const medicineMetadata = defineSpecialization({
  id: 'medicine',
  aliases: ['general', 'general_consultation'],
  category: 'vet',
  title: 'General Consultation',
  description:
    'Routine check-ups, illness evaluation, and preventive guidance from licensed veterinarians who know your pet\'s history and health goals.',
  highlightChips: ['Licensed Vets', 'Thorough Exam', 'Preventive Focus'],
  whatsIncluded: [
    { label: 'Physical Examination', icon: 'stethoscope' },
    { label: 'Health History Review', icon: 'calendar' },
    { label: 'Symptom Assessment', icon: 'brain' },
    { label: 'Treatment Recommendations', icon: 'check' },
    { label: 'Prescription Guidance', icon: 'heart' },
    { label: 'Follow-up Advice', icon: 'star' },
  ],
  benefits: [
    { title: 'Early Detection', description: 'Routine exams catch issues before they escalate.', icon: 'shield' },
    { title: 'Clear Answers', description: 'Understand symptoms and recommended next steps.', icon: 'graduation' },
    { title: 'Preventive Care', description: 'Vaccination, parasite, and diet guidance in one visit.', icon: 'check' },
    { title: 'Trusted Relationship', description: 'Continuity with vets who know your pet.', icon: 'heart' },
  ],
  whoIsThisFor: ['Annual wellness visits', 'New pet first check-up', 'When something seems off at home'],
  timeline: [
    { period: 'Consult', title: 'History and concern discussion' },
    { period: 'Exam', title: 'Head-to-tail physical check' },
    { period: 'Plan', title: 'Diagnosis and treatment options' },
    { period: 'Follow-up', title: 'Recovery guidance and next visit' },
  ],
  tips: ['Bring vaccination and medical records', 'Note when symptoms started', 'List current medications and supplements', 'Use a carrier for cats and small pets'],
});
