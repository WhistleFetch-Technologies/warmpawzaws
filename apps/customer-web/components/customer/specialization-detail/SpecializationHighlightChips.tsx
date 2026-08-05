'use client';

import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationHighlightChipsProps = {
  chips: string[];
};

export function SpecializationHighlightChips({ chips }: SpecializationHighlightChipsProps) {
  if (!chips.length) return null;

  return (
    <SpecializationDetailSection delay={0.04} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-orange-100 bg-orange-50 px-3.5 py-1.5 text-xs font-semibold text-[#E8742A] shadow-sm"
        >
          {chip}
        </span>
      ))}
    </SpecializationDetailSection>
  );
}
