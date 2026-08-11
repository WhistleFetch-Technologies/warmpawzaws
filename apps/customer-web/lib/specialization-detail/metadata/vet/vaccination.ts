import { defineVetSpecialization } from '../../define-vet';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from './vet-service-mode-defaults';

export const vaccinationMetadata = defineVetSpecialization({
  id: 'vaccination',
  title: 'Vaccination',
  description:
    'Preventive vaccines administered by qualified veterinarians to help protect pets from infectious diseases, based on individual health and lifestyle.',
  heroImage: '/images/home/Vet/vaccination.webp',
  // Wide hero box (≈2:1) vs landscape source: cover crops vertically; anchor to source top.
  heroImagePosition: 'center top',
  highlightChips: ['Preventive Care', 'Vet Guided', 'Pet Health'],
  serviceModeInformation: DEFAULT_VET_SERVICE_MODE_INFORMATION,
  sections: [
    {
      type: 'overview',
      title: 'What Is Pet Vaccination?',
      body: 'Vaccination helps the immune system recognize and respond to certain infectious diseases. Your veterinarian can recommend vaccines based on your pet’s species, age, health, and lifestyle.',
    },
    {
      type: 'benefits',
      title: 'Why Vaccination Matters',
      items: [
        'Helps reduce the risk of serious infectious diseases',
        'Supports community health through broader immunity',
        'May be required for boarding, travel, or licensing in some cases',
        'Often includes a wellness check during the visit',
      ],
    },
    {
      type: 'process',
      title: 'Vaccination Planning',
      body: 'There is no single schedule for every pet. Puppies, kittens, adult pets, and senior pets may have different needs. Your vet will discuss core and optional vaccines as appropriate.',
      steps: [
        { title: 'Health review', description: 'Your pet’s age, history, and lifestyle are considered.' },
        { title: 'Vaccine selection', description: 'Appropriate vaccines are discussed for your pet.' },
        { title: 'Scheduling', description: 'Initial doses and booster timing are planned if needed.' },
      ],
    },
    {
      type: 'what_to_expect',
      title: 'What Happens During The Visit?',
      steps: [
        { title: 'Pre-vaccination check', description: 'A brief exam confirms your pet is fit for vaccination.' },
        { title: 'Administration', description: 'The vaccine is given by a qualified veterinarian.' },
        { title: 'Observation', description: 'A short monitoring period may follow at the clinic.' },
        { title: 'Documentation', description: 'Vaccination records may be updated for your files.' },
      ],
    },
    {
      type: 'preparation',
      title: 'Before The Appointment',
      items: [
        'Bring previous vaccination records if available',
        'Mention any past reactions to vaccines',
        'Keep your pet calm and comfortable before travel',
        'Ask about fasting requirements — usually not needed for vaccines',
      ],
    },
    {
      type: 'after_care',
      title: 'After Vaccination',
      items: [
        'Mild tiredness or soreness at the injection site may occur',
        'Monitor your pet at home for unusual reactions',
        'Contact your vet if you notice persistent vomiting, swelling, or lethargy',
        'Follow any home-care guidance provided by the clinic',
      ],
    },
    {
      type: 'follow_up',
      title: 'Follow-up / Records',
      body: 'Booster doses may be recommended at intervals determined by your veterinarian. Keep vaccination certificates safe for travel, boarding, or future visits.',
    },
    {
      type: 'important',
      title: 'Important Information',
      body: 'Vaccine types and schedules vary by species, age, and local disease risk. Decisions should always be made with your veterinarian — this page provides general education only.',
      tone: 'info',
    },
  ],
});
