import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const dermatologyMetadata = defineVetSpecialization({
  id: 'dermatology',
  title: 'Skin Care',
  description:
    'Veterinary assessment and care for skin, coat, and ear concerns — from itching and rashes to ongoing dermatological conditions.',
  heroImage: '/images/home/Vet/skin-care.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Skin Health', 'Coat Care', 'Vet Assessment'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Veterinary Skin Care?',
      body: 'Skin care visits focus on conditions affecting your pet’s skin, coat, paws, or ears. A veterinarian can examine affected areas and discuss possible causes and care options.',
    },
    {
      type: 'common_concerns',
      title: 'Common Skin Concerns',
      items: [
        'Itching, scratching, or excessive licking',
        'Redness, rashes, or hot spots',
        'Hair loss or dull coat',
        'Ear discharge or head shaking',
        'Paw chewing or interdigital irritation',
      ],
    },
    {
      type: 'when_to_consider',
      title: 'Signs You May Notice',
      items: [
        'Persistent scratching lasting more than a few days',
        'Visible sores, bumps, or flaky skin',
        'Unpleasant odour from skin or ears',
        'Changes after diet, environment, or season',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Assess',
      items: [
        'Affected skin, coat, and ear areas',
        'Distribution and duration of symptoms',
        'Possible allergy or parasite history',
        'Secondary infection signs',
      ],
    },
    {
      type: 'categories',
      title: 'Possible Diagnostic Evaluation',
      body: 'Depending on findings, your veterinarian may suggest additional checks. Availability varies by provider.',
      categories: [
        {
          title: 'In-clinic checks',
          items: ['Skin scraping or cytology', 'Ear swab examination', 'Allergy history review'],
        },
        {
          title: 'Further testing',
          items: ['Blood tests if systemic illness is suspected', 'Culture or biopsy when indicated'],
        },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Examination', description: 'The vet inspects affected areas and asks about triggers.' },
        { title: 'Assessment', description: 'Possible causes are discussed without definitive diagnosis from symptoms alone.' },
        { title: 'Care plan', description: 'Treatment or management options are reviewed based on findings.' },
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Skin conditions often need monitoring. Your vet may recommend recheck visits to assess response to care and adjust the plan if needed.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Many skin signs can have similar appearances but different causes. Only a veterinarian can assess your pet properly — avoid self-diagnosing from symptoms alone.',
      tone: 'info',
    },
  ],
});
