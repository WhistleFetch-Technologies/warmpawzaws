import { defineSpecialization } from '../../define';

export const ophthalmologyMetadata = defineSpecialization({
  id: 'ophthalmology',
  category: 'vet',
  title: 'Eye Care',
  description:
    'Specialized eye examinations for redness, discharge, cloudiness, and vision changes—with treatment for infections, ulcers, and chronic conditions.',
  highlightChips: ['Eye Specialists', 'Vision Protection', 'Targeted Treatment'],
  whatsIncluded: [
    { label: 'Ophthalmic Exam', icon: 'stethoscope' },
    { label: 'Stain Testing', icon: 'check' },
    { label: 'Pressure Check', icon: 'brain' },
    { label: 'Topical Medications', icon: 'heart' },
    { label: 'Surgical Referral', icon: 'shield' },
    { label: 'Follow-up Care', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Vision Preservation', description: 'Early treatment prevents permanent damage.', icon: 'shield' },
    { title: 'Pain Relief', description: 'Eye conditions are often painful—treatment helps fast.', icon: 'heart' },
    { title: 'Accurate Diagnosis', description: 'Specialized tools detect ulcers and glaucoma.', icon: 'brain' },
    { title: 'Clear Guidance', description: 'Step-by-step medication and care instructions.', icon: 'graduation' },
  ],
  whoIsThisFor: ['Red, watery, or squinting eyes', 'Cloudiness or vision loss', 'Breed-prone eye conditions'],
  timeline: [
    { period: 'Exam', title: 'Detailed eye assessment' },
    { period: 'Test', title: 'Staining, pressure, or imaging' },
    { period: 'Treat', title: 'Drops, ointments, or referral' },
    { period: 'Review', title: 'Healing check and plan update' },
  ],
  tips: ['Do not let your pet rub the affected eye', 'Apply eye drops as directed—timing matters', 'Use an e-collar if scratching persists', 'Seek urgent care for sudden vision loss'],
});
