import type { VetServiceModeInformation } from '../../types';

export const DEFAULT_GROOMING_SERVICE_MODE_INFORMATION: VetServiceModeInformation = {
  at_home: {
    title: 'Grooming at your doorstep',
    description:
      'A professional groomer brings the required equipment to your home, prepares a safe grooming area, handles your pet gently, and cleans up after the service.',
  },
  at_center: {
    title: 'Visit a professional grooming centre',
    description:
      'Your pet is groomed at the centre using professional equipment. The groomer handles your pet safely and returns them clean and comfortable.',
  },
};

type GroomingModeOverride = {
  at_home?: { title?: string; description?: string };
  at_center?: { title?: string; description?: string };
};

export function groomingServiceModes(overrides?: GroomingModeOverride): VetServiceModeInformation {
  const base = DEFAULT_GROOMING_SERVICE_MODE_INFORMATION;
  return {
    at_home: {
      title: overrides?.at_home?.title ?? base.at_home!.title,
      description: overrides?.at_home?.description ?? base.at_home!.description,
    },
    at_center: {
      title: overrides?.at_center?.title ?? base.at_center!.title,
      description: overrides?.at_center?.description ?? base.at_center!.description,
    },
  };
}
