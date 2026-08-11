import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const neurologyMetadata = defineVetSpecialization({
  id: 'neurology',
  title: 'Neurology',
  description:
    'Veterinary assessment for nervous system concerns — including balance, coordination, seizures, and other neurological signs in pets.',
  heroImage: '/images/home/Vet/neurology.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Neurological Care', 'Vet Assessment', 'Specialized Support'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Veterinary Neurology?',
      body: 'Neurology focuses on the brain, spinal cord, and nerves. A veterinarian can evaluate signs that may suggest neurological involvement and discuss further steps.',
    },
    {
      type: 'common_concerns',
      title: 'Common Neurological Concerns',
      items: [
        'Seizures or convulsions',
        'Loss of balance or circling',
        'Weakness in one or more limbs',
        'Head tilt or abnormal eye movements',
        'Sudden behaviour or awareness changes',
      ],
    },
    {
      type: 'when_to_consider',
      title: 'Signs You May Notice',
      items: [
        'Dragging paws or knuckling on feet',
        'Tremors or muscle twitching',
        'Difficulty swallowing or eating',
        'Progressive mobility decline',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Assess',
      items: [
        'Mental status and responsiveness',
        'Reflexes and nerve function',
        'Gait, posture, and coordination',
        'Neck and spine sensitivity',
      ],
    },
    {
      type: 'categories',
      title: 'Possible Diagnostic Evaluation',
      body: 'Advanced neurology workup availability varies by provider.',
      categories: [
        {
          title: 'Initial assessment',
          items: ['Neurological examination', 'Blood tests to rule out metabolic causes'],
        },
        {
          title: 'Advanced testing',
          items: ['MRI or CT at referral centres when indicated', 'Cerebrospinal fluid analysis at specialist facilities'],
        },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Detailed history', description: 'Onset, duration, and progression of signs are reviewed.' },
        { title: 'Neuro exam', description: 'The vet performs a structured neurological assessment.' },
        { title: 'Plan discussion', description: 'Further tests or referral options are explained.' },
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Neurological conditions often need ongoing monitoring. Your veterinarian or specialist will advise on recheck frequency and home observation.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Active seizures lasting more than a few minutes, repeated seizures, or sudden collapse require urgent veterinary attention. Do not attempt to diagnose neurological conditions from symptoms alone.',
      tone: 'warning',
    },
  ],
});
