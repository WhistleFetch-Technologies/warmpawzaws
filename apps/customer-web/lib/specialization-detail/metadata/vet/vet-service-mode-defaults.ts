import type { VetServiceModeInformation } from '../../types';

export const DEFAULT_VET_SERVICE_MODE_INFORMATION: VetServiceModeInformation = {
  at_home: {
    title: 'Veterinary Care At Home',
    description: 'A veterinarian may visit your pet at home, depending on availability and the care needed.',
  },
  at_center: {
    title: 'Veterinary Care At Centre',
    description: 'Visit the veterinary centre for consultation, assessment, and in-clinic care.',
  },
  tele: {
    title: 'Tele Consultation',
    description: 'Consult with a veterinarian remotely for guidance, follow-up, or initial assessment.',
  },
};
