import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const labDiagnosticsMetadata = defineVetSpecialization({
  id: 'lab_diagnostics',
  title: 'Lab & Diagnostics',
  description:
    'Diagnostic testing helps veterinarians investigate health concerns, monitor conditions, and guide care decisions based on your pet’s needs.',
  heroImage: '/images/home/Vet/lab-diagnostics.webp',
  heroImagePosition: 'center 12%',
  highlightChips: ['Investigative Care', 'Vet Guided', 'In-Clinic Testing'],
  serviceModeInformation: {
    at_center: DEFAULT_VET_SERVICE_MODE_INFORMATION.at_center,
  },
  sections: [
    {
      type: 'overview',
      title: 'What Are Pet Diagnostics?',
      body: 'Diagnostics are tests and assessments used to look more closely at your pet’s health. Results can help a veterinarian understand what may be happening and discuss next steps with you.',
    },
    {
      type: 'when_to_consider',
      title: 'When Might Your Pet Need Testing?',
      items: [
        'Unexplained changes in appetite, energy, or weight',
        'Monitoring of an ongoing condition',
        'Pre-procedure assessment when advised by your vet',
        'Follow-up after treatment to track progress',
      ],
    },
    {
      type: 'categories',
      title: 'What Can Be Checked?',
      body: 'Depending on the clinic and your pet’s needs, diagnostics may include sample-based tests or imaging. Available options can vary by provider.',
      categories: [
        {
          title: 'Blood testing',
          items: ['General health markers', 'Organ function panels', 'Infection or inflammation indicators'],
        },
        {
          title: 'Urine testing',
          items: ['Urinalysis for kidney or urinary concerns', 'Sample collection at the clinic'],
        },
        {
          title: 'Fecal testing',
          items: ['Parasite screening when recommended', 'Digestive health assessment'],
        },
        {
          title: 'Imaging',
          items: ['X-rays or ultrasound when available at the centre', 'Referral for advanced imaging if needed'],
        },
      ],
    },
    {
      type: 'included',
      title: 'Common Diagnostic Tests',
      items: [
        'Sample collection and handling as part of the visit',
        'Basic in-clinic tests when offered by the provider',
        'Discussion of which tests may be appropriate for your pet',
        'Interpretation of results by the attending veterinarian',
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Consultation', description: 'Your vet reviews history and may recommend specific tests.' },
        { title: 'Sample collection', description: 'Blood, urine, or other samples may be collected at the centre.' },
        { title: 'Processing', description: 'Some results may be available quickly; others may take longer.' },
        { title: 'Review', description: 'Your vet explains findings and possible follow-up options.' },
      ],
    },
    {
      type: 'preparation',
      title: 'Before Your Appointment',
      items: [
        'Follow any fasting instructions given by the clinic',
        'Bring previous lab reports if you have them',
        'Note recent medications or supplements',
        'Ask whether you should collect a urine sample at home',
      ],
    },
    {
      type: 'follow_up',
      title: 'Results & Follow-up',
      body: 'Result timelines depend on the test type and lab processing. Your veterinarian can explain what the findings may mean for your pet and whether further assessment is needed.',
      items: [
        'Ask when results are expected',
        'Discuss any follow-up visits or repeat testing',
        'Keep copies of reports for future visits',
      ],
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Not every provider offers every diagnostic test. Test selection depends on your pet’s symptoms, examination findings, and the veterinarian’s clinical judgment.',
      tone: 'info',
    },
  ],
});
