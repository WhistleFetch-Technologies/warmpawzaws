import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const ophthalmologyMetadata = defineVetSpecialization({
  id: 'ophthalmology',
  title: 'Eye Care',
  description:
    'Veterinary assessment for eye and vision-related concerns, helping identify discomfort and guide appropriate care for your pet.',
  heroImage: '/images/home/Vet/eye-care.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Eye Health', 'Vision Support', 'Vet Assessment'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Veterinary Eye Care?',
      body: 'Eye care consultations focus on conditions affecting your pet’s eyes and vision. Early veterinary assessment can help address discomfort and prevent complications.',
    },
    {
      type: 'common_concerns',
      title: 'Common Eye Concerns',
      items: [
        'Redness or swelling around the eye',
        'Discharge or excessive tearing',
        'Cloudiness or changes in eye appearance',
        'Squinting or keeping an eye closed',
        'Rubbing or pawing at the face',
      ],
    },
    {
      type: 'when_to_consider',
      title: 'Signs You May Notice',
      items: [
        'Sudden changes in one or both eyes',
        'Visible third eyelid or bulging',
        'Bumping into objects or hesitation in dim light',
        'Sensitivity to light',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Examine',
      items: [
        'Eyelids, cornea, and conjunctiva',
        'Pupil response and eye movement',
        'Signs of pain or injury',
        'Whether one or both eyes are affected',
      ],
    },
    {
      type: 'categories',
      title: 'Possible Diagnostic Evaluation',
      body: 'Additional tests may be suggested depending on findings and provider capabilities.',
      categories: [
        {
          title: 'In-clinic assessment',
          items: ['Fluorescein stain for corneal scratches', 'Tonometry for eye pressure when available'],
        },
        {
          title: 'Referral',
          items: ['Specialist ophthalmology referral for complex cases'],
        },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Eye examination', description: 'The vet inspects affected eyes carefully.' },
        { title: 'Findings review', description: 'Possible causes are discussed with you.' },
        { title: 'Care plan', description: 'Treatment or referral options are outlined as appropriate.' },
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Eye conditions can change quickly. Your veterinarian may recommend prompt rechecks to monitor healing or response to treatment.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Eye problems can worsen rapidly. Sudden vision loss or severe eye pain may need urgent care. Do not apply human eye drops unless directed by your veterinarian.',
      tone: 'warning',
    },
  ],
});
