import type { ServiceModeDetail, VetServiceModeInformation } from '../../types';

export const DEFAULT_TRAINING_SERVICE_MODE_INFORMATION: VetServiceModeInformation = {
  at_home: {
    title: 'Training at your home',
    description:
      'A professional trainer visits your home and works with your pet in its familiar environment.',
  },
  at_center: {
    title: 'Training at a professional centre',
    description:
      'Structured training sessions in a professional environment with appropriate equipment and distractions.',
  },
};

type TrainingModeOverride = {
  at_home?: Partial<ServiceModeDetail>;
  at_center?: Partial<ServiceModeDetail>;
};

function mergeMode(
  base: ServiceModeDetail,
  override?: Partial<ServiceModeDetail>,
): ServiceModeDetail {
  if (!override) return base;
  return {
    title: override.title ?? base.title,
    description: override.description ?? base.description,
    details: override.details ?? base.details,
  };
}

export function trainingServiceModes(overrides?: TrainingModeOverride): VetServiceModeInformation {
  const base = DEFAULT_TRAINING_SERVICE_MODE_INFORMATION;
  return {
    at_home: mergeMode(base.at_home!, overrides?.at_home),
    at_center: mergeMode(base.at_center!, overrides?.at_center),
  };
}
