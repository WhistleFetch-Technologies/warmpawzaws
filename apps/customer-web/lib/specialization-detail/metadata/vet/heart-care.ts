import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const cardiologyMetadata = defineVetSpecialization({
  id: 'cardiology',
  title: 'Heart Care',
  description:
    'Veterinary assessment and monitoring for heart-related concerns, supporting early detection and ongoing cardiac health management.',
  heroImage: '/images/home/Vet/heart-care.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Heart Health', 'Specialized Assessment', 'Vet Guided'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Veterinary Heart Care?',
      body: 'Heart care visits focus on the cardiovascular system — how the heart and circulation are functioning. Your veterinarian can assess signs that may suggest cardiac concerns.',
    },
    {
      type: 'when_to_consider',
      title: 'When May Heart Evaluation Be Needed?',
      items: [
        'Coughing, especially at night or after exercise',
        'Reduced stamina or exercise intolerance',
        'Breathing changes or restlessness',
        'Fainting episodes or collapse',
        'Monitoring of a previously diagnosed heart condition',
      ],
    },
    {
      type: 'common_concerns',
      title: 'Signs / Concerns To Discuss With Your Vet',
      items: [
        'Fast or irregular heartbeat noticed at home',
        'Pale or bluish gum colour',
        'Abdominal swelling or fluid retention',
        'Weight loss despite normal appetite',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Assess',
      items: [
        'Heart rate, rhythm, and murmur detection',
        'Lung sounds and breathing pattern',
        'Gum colour and pulse quality',
        'Overall fitness for activity level and age',
      ],
    },
    {
      type: 'categories',
      title: 'Possible Cardiac Tests',
      body: 'Test availability depends on the clinic and your pet’s condition.',
      categories: [
        {
          title: 'Common assessments',
          items: ['Chest X-rays when available', 'Electrocardiogram (ECG) at some centres', 'Blood tests including cardiac markers'],
        },
        {
          title: 'Advanced care',
          items: ['Echocardiography (heart ultrasound) at equipped facilities', 'Referral to a veterinary cardiologist if needed'],
        },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'History & exam', description: 'Your vet listens to the heart and reviews symptoms.' },
        { title: 'Testing discussion', description: 'Recommended tests are explained based on findings.' },
        { title: 'Management plan', description: 'Monitoring and treatment options are reviewed if indicated.' },
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Heart conditions often require ongoing monitoring. Regular rechecks help your veterinarian adjust care as your pet’s needs change.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Breathing difficulty or collapse can be emergencies. If your pet is in acute distress, seek urgent veterinary care immediately rather than waiting for a routine appointment.',
      tone: 'warning',
    },
  ],
});
