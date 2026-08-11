import type { SpecializationFeatureItem } from '../../types';

export function nutritionFeatures(labels: string[]): SpecializationFeatureItem[] {
  return labels.map((label) => ({ label, icon: 'check' }));
}
