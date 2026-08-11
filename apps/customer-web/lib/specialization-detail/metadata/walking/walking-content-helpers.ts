import type { SpecializationFeatureItem } from '../../types';

export function walkingFeatures(labels: string[]): SpecializationFeatureItem[] {
  return labels.map((label) => ({ label, icon: 'check' }));
}
