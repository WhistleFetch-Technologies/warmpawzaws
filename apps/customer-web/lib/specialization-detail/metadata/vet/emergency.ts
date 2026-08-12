import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const emergencyMetadata = defineVetSpecialization({
  id: 'emergency',
  title: 'Emergency',
  description:
    'Urgent veterinary attention for accidents, sudden illness, and life-threatening situations that cannot wait for a routine appointment.',
  highlightChips: ['Urgent Care', 'Veterinary Support', 'Priority Attention'],
  visualVariant: 'emergency',
  serviceModeInformation: {
    at_center: {
      title: 'Emergency Care At Centre',
      description: 'Visit an equipped veterinary centre for urgent assessment and stabilization when available.',
    },
    tele: {
      title: 'Tele Guidance',
      description: 'Remote consultation may help assess urgency — it is not a substitute for hands-on emergency care when needed.',
    },
  },
  sections: [
    {
      type: 'overview',
      title: 'Veterinary Emergency Care',
      body: 'Emergency veterinary care addresses sudden, severe, or rapidly worsening conditions. If you believe your pet’s life is at risk, seek veterinary help without delay.',
      tone: 'warning',
    },
    {
      type: 'when_to_consider',
      title: 'When Should You Seek Urgent Veterinary Help?',
      items: [
        'Difficulty breathing or choking',
        'Collapse, seizures, or inability to stand',
        'Severe bleeding or open wounds',
        'Suspected poisoning or toxin ingestion',
        'Repeated vomiting with lethargy or bloated abdomen',
        'Trauma from accidents or falls',
      ],
      tone: 'warning',
    },
    {
      type: 'common_concerns',
      title: 'Common Emergency Situations',
      items: [
        'Road traffic accidents',
        'Heatstroke or severe dehydration',
        'Inability to urinate (especially male cats)',
        'Eye injuries or sudden vision loss',
        'Labour complications during whelping',
      ],
      tone: 'warning',
    },
    {
      type: 'process',
      title: 'What To Do While Seeking Veterinary Care',
      steps: [
        { title: 'Contact a vet immediately', description: 'Call ahead if possible so the clinic can prepare.' },
        { title: 'Transport safely', description: 'Keep your pet warm, still, and secure during travel.' },
        { title: 'Bring information', description: 'Pack medication lists and any suspected toxin packaging.' },
        { title: 'Do not delay', description: 'Waiting can worsen outcomes — seek care promptly.' },
      ],
      tone: 'warning',
    },
    {
      type: 'included',
      title: 'What The Vet May Assess',
      items: [
        'Immediate triage and stabilization',
        'Vital signs and pain assessment',
        'Diagnostic tests when urgently needed',
        'Discussion of treatment options with you',
      ],
    },
    {
      type: 'emergency',
      title: 'Important Emergency Notice',
      body: 'If your pet is unconscious, not breathing, or in severe distress, go to the nearest emergency veterinary facility immediately. Do not rely on online information or teleconsultation alone in life-threatening situations.',
      tone: 'warning',
    },
    {
      type: 'important',
      title: 'Service Availability',
      body: 'Emergency service hours and capabilities vary by provider and location. Warmpawz shows available options — not all clinics offer 24/7 emergency care. Confirm availability when booking or calling.',
      tone: 'info',
    },
  ],
});
