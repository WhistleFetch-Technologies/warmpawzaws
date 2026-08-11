'use client';

import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetConcernGridProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetConcernGrid({ section, variant = 'default', delay = 0.08 }: VetConcernGridProps) {
  const styles = vetVariantClasses(variant);
  const items = section.items ?? [];

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <h3 className="mb-4 text-base font-bold text-slate-900">{section.title}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
