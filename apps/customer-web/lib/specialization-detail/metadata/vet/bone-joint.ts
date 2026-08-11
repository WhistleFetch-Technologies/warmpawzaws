import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const orthopedicsMetadata = defineVetSpecialization({
  id: 'orthopedics',
  title: 'Bone & Joint',
  description:
    'Veterinary assessment and care for mobility, bone, and joint concerns — from limping and stiffness to injury recovery support.',
  heroImage: '/images/home/Vet/bone-joint.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Mobility Support', 'Joint Health', 'Vet Assessment'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Bone & Joint Care?',
      body: 'Bone and joint care addresses problems affecting how your pet moves and bears weight. A veterinarian can examine gait, joints, and comfort levels to guide next steps.',
    },
    {
      type: 'common_concerns',
      title: 'Common Mobility Concerns',
      items: [
        'Limping or favouring a leg',
        'Difficulty rising, jumping, or climbing stairs',
        'Joint stiffness, especially after rest',
        'Swelling or heat around a joint',
        'Reduced activity in senior pets',
      ],
    },
    {
      type: 'when_to_consider',
      title: 'Signs Of Discomfort',
      items: [
        'Yelping or withdrawal when touched',
        'Reluctance to walk or play',
        'Abnormal sitting or lying posture',
        'Muscle loss in affected limbs',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Assess',
      items: [
        'Gait and weight bearing',
        'Joint range of motion and pain response',
        'Spine and limb palpation',
        'Age-related degenerative changes',
      ],
    },
    {
      type: 'categories',
      title: 'Possible Diagnostic Tests',
      body: 'Imaging and tests depend on the clinic and your pet’s presentation.',
      categories: [
        {
          title: 'In-clinic evaluation',
          items: ['Orthopaedic examination', 'Joint fluid analysis when indicated'],
        },
        {
          title: 'Imaging',
          items: ['X-rays for fractures or arthritis', 'Referral for advanced imaging if needed'],
        },
      ],
    },
    {
      type: 'benefits',
      title: 'Treatment / Management Discussion',
      items: [
        'Pain management options',
        'Weight and exercise guidance',
        'Physiotherapy or rehabilitation referrals when available',
        'Surgical options for certain conditions when appropriate',
      ],
    },
    {
      type: 'after_care',
      title: 'Recovery & Follow-up',
      items: [
        'Rest and restricted activity as advised',
        'Medication compliance and monitoring',
        'Gradual return to exercise under vet guidance',
        'Recheck visits to track improvement',
      ],
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Sudden inability to use a limb or severe pain may indicate an emergency. Limping causes are varied — only a veterinarian can assess your pet properly after examination.',
      tone: 'info',
    },
  ],
});
