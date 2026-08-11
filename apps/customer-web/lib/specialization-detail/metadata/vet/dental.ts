import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const dentistryMetadata = defineVetSpecialization({
  id: 'dentistry',
  title: 'Dental',
  description:
    'Professional veterinary dental assessment and care to support oral health, comfort, and overall wellbeing for dogs and cats.',
  heroImage: '/images/home/Vet/dental.webp',
  // Wide hero box vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Oral Health', 'Professional Care', 'Preventive'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Pet Dental Care?',
      body: 'Dental care addresses the health of your pet’s teeth, gums, and mouth. Regular assessment can help identify discomfort and prevent progression of oral disease.',
    },
    {
      type: 'common_concerns',
      title: 'Common Dental Concerns',
      items: [
        'Plaque and tartar buildup',
        'Red or bleeding gums',
        'Bad breath (halitosis)',
        'Loose or fractured teeth',
        'Difficulty eating or pawing at the mouth',
      ],
    },
    {
      type: 'when_to_consider',
      title: 'Signs To Watch For',
      items: [
        'Reluctance to eat hard food or treats',
        'Drooling or dropping food',
        'Visible tartar or discoloured teeth',
        'Swelling around the face or jaw',
      ],
    },
    {
      type: 'included',
      title: 'What The Vet May Check',
      items: [
        'Teeth, gums, and tongue condition',
        'Signs of pain or inflammation',
        'Bite alignment and jaw mobility',
        'Need for professional cleaning or extractions',
      ],
    },
    {
      type: 'benefits',
      title: 'Professional Dental Care',
      items: [
        'Scaling and polishing under veterinary supervision when needed',
        'Assessment of teeth requiring attention',
        'Pain management planning for procedures',
        'Guidance on maintaining oral health at home',
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Oral exam', description: 'The vet evaluates your pet’s mouth — sedation may be needed for full assessment.' },
        { title: 'Discussion', description: 'Findings and recommended procedures are explained.' },
        { title: 'Procedure planning', description: 'If cleaning or treatment is advised, pre-anaesthesia checks may be discussed.' },
      ],
    },
    {
      type: 'after_care',
      title: 'Home Dental Care',
      items: [
        'Tooth brushing with pet-safe products when tolerated',
        'Dental chews or diets as recommended by your vet',
        'Regular oral checks at home between visits',
        'Avoid human toothpaste — it is not safe for pets',
      ],
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Dental procedures and anaesthesia requirements depend on your pet’s oral condition and overall health. Outcomes vary — your veterinarian will explain risks and benefits for your pet.',
      tone: 'info',
    },
  ],
});
