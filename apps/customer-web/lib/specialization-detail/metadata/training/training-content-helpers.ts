import type { SpecializationBenefitItem, SpecializationFeatureItem } from '../../types';

export function trainingFeatures(labels: string[]): SpecializationFeatureItem[] {
  return labels.map((label) => ({ label, icon: 'check' }));
}

export function trainingBenefits(
  items: Array<{ title: string; description?: string; icon?: string }>,
): SpecializationBenefitItem[] {
  return items.map(({ title, description = '', icon = 'check' }) => ({
    title,
    description,
    icon,
  }));
}
