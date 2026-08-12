'use client';

import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetHighlightChipsProps = {
  chips: string[];
  variant?: VetVisualVariant;
};

export function VetHighlightChips({ chips, variant = 'default' }: VetHighlightChipsProps) {
  if (!chips.length) return null;

  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={0.04} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm ${styles.chip}`}
        >
          {chip}
        </span>
      ))}
    </SpecializationDetailSection>
  );
}
