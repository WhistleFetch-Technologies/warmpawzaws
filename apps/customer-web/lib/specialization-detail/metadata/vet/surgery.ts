import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const surgeryMetadata = defineVetSpecialization({
  id: 'surgery',
  title: 'Surgery',
  description:
    'Veterinary surgical care for planned procedures, from pre-operative assessment through recovery support, as recommended by your veterinarian.',
  heroImage: '/images/home/Vet/surgery.webp',
  // Subject spans top (OR signage) to bottom (dog head); center-top would clip the patient.
  heroImagePosition: 'center 55%',
  highlightChips: ['Surgical Care', 'Vet Supervised', 'Recovery Support'],
  serviceModeInformation: {
    at_center: DEFAULT_VET_SERVICE_MODE_INFORMATION.at_center,
  },
  sections: [
    {
      type: 'overview',
      title: 'What Is Veterinary Surgery?',
      body: 'Veterinary surgery includes operative procedures performed under professional supervision to address injuries, disease, or preventive needs such as spay/neuter when recommended.',
    },
    {
      type: 'when_to_consider',
      title: 'When May Surgery Be Recommended?',
      items: [
        'Spay or neuter as part of responsible pet ownership',
        'Removal of masses or foreign objects',
        'Orthopaedic repair for fractures or joint issues',
        'Soft-tissue procedures when conservative care is insufficient',
      ],
    },
    {
      type: 'process',
      title: 'Pre-Surgery Assessment',
      steps: [
        { title: 'Consultation', description: 'Your vet explains why surgery may be appropriate.' },
        { title: 'Health screening', description: 'Blood tests or imaging may be advised before anaesthesia.' },
        { title: 'Risk discussion', description: 'Anaesthesia risks and expected recovery are reviewed.' },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What To Expect',
      body: 'Each surgical case is unique. Your veterinarian will outline the specific plan for your pet.',
      steps: [
        { title: 'Admission', description: 'Your pet is checked in and prepared for the procedure.' },
        { title: 'Anaesthesia & monitoring', description: 'Vital signs are monitored throughout surgery.' },
        { title: 'Recovery', description: 'Your pet is observed as anaesthesia wears off.' },
        { title: 'Discharge briefing', description: 'Home care instructions are provided before you leave.' },
      ],
    },
    {
      type: 'preparation',
      title: 'Preparation Before Surgery',
      items: [
        'Follow fasting instructions exactly as given',
        'Inform the vet of all medications and supplements',
        'Arrange a quiet recovery space at home',
        'Plan transport and post-operative supervision',
      ],
    },
    {
      type: 'included',
      title: 'During The Procedure',
      items: [
        'Sterile surgical environment at the veterinary centre',
        'Anaesthesia administered and monitored by trained staff',
        'Pain management as part of the surgical plan',
        'Updates to you when the clinic’s process allows',
      ],
    },
    {
      type: 'after_care',
      title: 'Recovery & After-Care',
      items: [
        'Limit activity as instructed — no jumping or rough play',
        'Prevent licking of incisions with an e-collar if advised',
        'Administer prescribed medications on schedule',
        'Watch for redness, swelling, or discharge at the site',
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up',
      body: 'Suture removal or wound checks may be scheduled. Contact your vet promptly if your pet seems painful, lethargic, or unwell during recovery.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Surgical outcomes depend on the procedure, your pet’s health, and post-operative care. Not all providers perform every type of surgery — availability varies.',
      tone: 'info',
    },
  ],
});
