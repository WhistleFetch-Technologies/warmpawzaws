import { defineSpecialization } from '../../define';

export const vaccinationMetadata = defineSpecialization({
  id: 'vaccination',
  category: 'vet',
  title: 'Vaccination',
  description:
    'Core and optional vaccines administered by qualified veterinarians to protect your pet from serious infectious diseases and meet travel or boarding requirements.',
  highlightChips: ['Licensed Vets', 'Safe Protocols', 'Record Keeping'],
  whatsIncluded: [
    { label: 'Pre-Vaccination Exam', icon: 'stethoscope' },
    { label: 'Core Vaccines', icon: 'shield' },
    { label: 'Optional Boosters', icon: 'check' },
    { label: 'Vaccination Certificate', icon: 'calendar' },
    { label: 'Post-Shot Guidance', icon: 'heart' },
    { label: 'Reminder Scheduling', icon: 'clock' },
  ],
  benefits: [
    { title: 'Disease Protection', description: 'Shields against parvo, rabies, distemper, and more.', icon: 'shield' },
    { title: 'Travel & Boarding Ready', description: 'Documentation accepted where required.', icon: 'check' },
    { title: 'Health Check Included', description: 'Vet assesses overall wellness during the visit.', icon: 'stethoscope' },
    { title: 'Long-term Wellness', description: 'Preventive care saves cost and heartache later.', icon: 'heart' },
  ],
  whoIsThisFor: ['Puppies and kittens starting schedules', 'Annual booster updates', 'Pre-boarding or travel preparation'],
  timeline: [
    { period: 'Visit', title: 'Pre-vaccination health examination' },
    { period: 'Vaccinate', title: 'Vaccine administered safely' },
    { period: 'Monitor', title: 'Brief observation period' },
    { period: 'After', title: 'Home care tips and next due date' },
  ],
  tips: ['Bring previous vaccination records', 'Note any past vaccine reactions', 'Keep your pet calm before the visit', 'Watch for mild lethargy in the first 24 hours'],
});
