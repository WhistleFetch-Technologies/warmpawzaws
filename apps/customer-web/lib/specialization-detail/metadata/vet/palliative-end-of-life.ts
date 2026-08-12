import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const palliativeMetadata = defineVetSpecialization({
  id: 'palliative',
  title: 'Palliative & End-of-Life Care',
  description:
    'Compassionate veterinary support focused on comfort, quality of life, and gentle guidance for pets and families during difficult times.',
  heroImage: '/images/home/Vet/palliative-end-of-life-care.webp',
  highlightChips: ['Comfort Focused', 'Quality of Life', 'Compassionate Care'],
  visualVariant: 'palliative',
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Palliative & End-of-Life Care?',
      body: 'Palliative care aims to support comfort and dignity when a pet has a serious or progressive condition. End-of-life support helps families make thoughtful decisions with veterinary guidance.',
      tone: 'calm',
    },
    {
      type: 'when_to_consider',
      title: 'When May This Support Be Considered?',
      items: [
        'When a pet has a chronic or advanced illness affecting daily comfort',
        'When treatment focus shifts toward quality of life rather than cure',
        'When families need help assessing pain, mobility, or appetite changes',
        'When planning compassionate end-of-life care with veterinary support',
      ],
      tone: 'calm',
    },
    {
      type: 'benefits',
      title: 'Comfort & Quality-of-Life Support',
      items: [
        'Pain and symptom management discussions',
        'Nutrition, hydration, and mobility support planning',
        'Adjustments to home environment for comfort',
        'Regular reassessment as your pet’s needs change',
      ],
      tone: 'calm',
    },
    {
      type: 'included',
      title: 'What The Veterinary Team May Assess',
      items: [
        'Pain levels and signs of discomfort',
        'Appetite, hydration, and rest patterns',
        'Mobility and ability to enjoy daily routines',
        'Emotional wellbeing of both pet and family',
      ],
      tone: 'calm',
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      steps: [
        { title: 'Gentle consultation', description: 'Your vet listens to your concerns and reviews your pet’s history.' },
        { title: 'Comfort assessment', description: 'Physical and behavioural signs are discussed with care.' },
        { title: 'Care planning', description: 'Options for comfort support are explored based on your pet’s situation.' },
        { title: 'Ongoing support', description: 'Follow-up visits may help adjust the plan over time.' },
      ],
      tone: 'calm',
    },
    {
      type: 'follow_up',
      title: 'Support For Pet Parents',
      body: 'This can be an emotional journey. Your veterinary team can help you understand options, answer questions, and support decision-making at a pace that feels right for your family.',
      tone: 'calm',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Every pet and family situation is unique. Outcomes and care paths depend on medical findings and professional judgment. This information is educational and does not replace a consultation with your veterinarian.',
      tone: 'calm',
    },
  ],
});
