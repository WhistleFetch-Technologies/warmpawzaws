import { defineSpecialization } from '../../define';

export const reproductiveMetadata = defineSpecialization({
  id: 'reproductive',
  category: 'vet',
  title: 'Reproductive Care',
  description:
    'Breeding consultations, pregnancy monitoring, whelping support, and reproductive health services for responsible pet breeding and family planning.',
  highlightChips: ['Breeding Expertise', 'Pregnancy Care', 'Health Screening'],
  whatsIncluded: [
    { label: 'Breeding Consultation', icon: 'stethoscope' },
    { label: 'Pregnancy Ultrasound', icon: 'check' },
    { label: 'Pre-Breeding Health Screen', icon: 'shield' },
    { label: 'Whelping Support', icon: 'heart' },
    { label: 'Neuter/Spay Counselling', icon: 'graduation' },
    { label: 'Postnatal Check', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Healthy Litters', description: 'Screening reduces genetic and infectious risks.', icon: 'shield' },
    { title: 'Safe Pregnancy', description: 'Monitoring catches complications early.', icon: 'heart' },
    { title: 'Informed Breeding', description: 'Guidance on timing, nutrition, and care.', icon: 'graduation' },
    { title: 'Responsible Choices', description: 'Support for spay/neuter when breeding isn\'t planned.', icon: 'check' },
  ],
  whoIsThisFor: ['Registered breeders', 'Accidental pregnancy concerns', 'Owners considering spay or neuter'],
  timeline: [
    { period: 'Pre-breed', title: 'Health screen and breeding readiness' },
    { period: 'Pregnancy', title: 'Ultrasound and nutrition planning' },
    { period: 'Whelping', title: 'Delivery support or emergency guidance' },
    { period: 'Postnatal', title: 'Mother and puppy/kitten check' },
  ],
  tips: ['Ensure both parents are health-tested', 'Prepare a whelping box in advance', 'Know emergency vet hours before due date', 'Discuss microchipping for offspring early'],
});
