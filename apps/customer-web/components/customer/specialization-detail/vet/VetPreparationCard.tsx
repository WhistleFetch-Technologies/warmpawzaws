'use client';

import { ClipboardList } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetPreparationCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetPreparationCard({ section, variant = 'default', delay = 0.08 }: VetPreparationCardProps) {
  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className={`h-5 w-5 ${styles.accent}`} />
          <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
        </div>
        <ul className="space-y-2.5">
          {(section.items ?? []).map((item) => (
            <li key={item} className="rounded-xl border border-dashed border-orange-100 bg-orange-50/40 px-3.5 py-2.5 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </SpecializationDetailSection>
  );
}
