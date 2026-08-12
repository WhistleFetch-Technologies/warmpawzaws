import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const reproductiveMetadata = defineVetSpecialization({
  id: 'reproductive',
  title: 'Reproductive & Breeding',
  description:
    'Veterinary guidance for reproductive health, breeding planning, pregnancy support, and related assessments for dogs and cats.',
  heroImage: '/images/home/Vet/reproductive-breeding.webp',
  heroImagePosition: 'center top',
  highlightChips: ['Reproductive Health', 'Vet Guided', 'Breeding Support'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'when_to_consider',
      title: 'When Is Veterinary Guidance Useful?',
      items: [
        'Pre-breeding health checks for prospective parents',
        'Pregnancy monitoring and postnatal support',
        'Concerns about heat cycles, fertility, or reproductive behaviour',
        'Post-whelping or post-queening health checks',
      ],
    },
    {
      type: 'included',
      title: 'Reproductive Assessment',
      items: [
        'Physical examination and history review',
        'Discussion of breeding suitability and timing',
        'Basic reproductive health screening when available',
        'Guidance on nutrition and care during pregnancy',
      ],
    },
    {
      type: 'benefits',
      title: 'Breeding / Pregnancy Support',
      items: [
        'Monitoring maternal health during pregnancy',
        'Identifying signs that may need urgent attention',
        'Neonatal care guidance after birth',
        'Follow-up planning for mother and litter',
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Initial consultation', description: 'Your vet reviews reproductive history and goals.' },
        { title: 'Assessment', description: 'Examination and any recommended tests are discussed.' },
        { title: 'Care plan', description: 'Timelines and monitoring steps are outlined as appropriate.' },
        { title: 'Follow-up', description: 'Additional visits may be advised during pregnancy or recovery.' },
      ],
    },
    {
      type: 'preparation',
      title: 'Preparation',
      items: [
        'Share breeding dates and previous litter history if known',
        'Note any medications or supplements',
        'Prepare questions about timing, nutrition, and warning signs',
        'Keep emergency contact details accessible during whelping',
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Reproductive care often involves multiple visits. Your veterinarian can advise on check-up frequency based on your pet’s stage and condition.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Breeding and pregnancy outcomes cannot be guaranteed. Available procedures and tests depend on the provider and your pet’s health. Always seek urgent care if your pet shows signs of distress during labour.',
      tone: 'info',
    },
  ],
});
