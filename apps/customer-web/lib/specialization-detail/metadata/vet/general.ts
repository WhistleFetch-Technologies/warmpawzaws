import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const medicineMetadata = defineVetSpecialization({
  id: 'medicine',
  title: 'General',
  description:
    'A general veterinary consultation for routine health checks, new concerns, and overall wellbeing assessments for your pet.',
  heroImage: '/images/home/Vet/general-veterinary-care.webp',
  // Wide hero box (≈2:1) vs landscape source (≈1.5:1): cover crops vertically.
  // Any Y > 0% still clips the top; anchor to source top so the vet's head stays visible.
  heroImagePosition: 'center top',
  highlightChips: ['Health Check', 'Vet Consultation', 'Wellbeing'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is A General Consultation?',
      body: 'A general consultation is a visit with a veterinarian to discuss your pet’s health, address concerns, and receive professional guidance on care and next steps.',
    },
    {
      type: 'when_to_consider',
      title: 'When Should You Consult A Vet?',
      items: [
        'Annual or routine wellness visits',
        'New symptoms such as vomiting, limping, or behaviour changes',
        'Weight, appetite, or energy level concerns',
        'Medication refills or follow-up after prior treatment',
      ],
    },
    {
      type: 'included',
      title: 'What May The Veterinarian Assess?',
      items: [
        'Weight, temperature, and vital signs',
        'Eyes, ears, skin, and coat condition',
        'Heart and lung auscultation',
        'Mobility, dental overview, and general behaviour',
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect During The Visit',
      steps: [
        { title: 'History taking', description: 'You share your pet’s symptoms, diet, and recent changes.' },
        { title: 'Physical exam', description: 'The vet examines your pet from nose to tail.' },
        { title: 'Discussion', description: 'Findings are explained and options are reviewed together.' },
        { title: 'Next steps', description: 'Tests, treatment, or follow-up may be recommended if needed.' },
      ],
    },
    {
      type: 'preparation',
      title: 'What To Bring',
      items: [
        'Previous medical records or vaccination history',
        'List of current medications and supplements',
        'A fresh urine or stool sample if requested',
        'Your pet on a leash or in a secure carrier',
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Depending on the findings, your veterinarian may suggest a recheck visit, further tests, or referral to a specialist.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'A general consultation is not a substitute for emergency care. If your pet is in severe distress, seek urgent veterinary attention immediately.',
      tone: 'info',
    },
  ],
});
