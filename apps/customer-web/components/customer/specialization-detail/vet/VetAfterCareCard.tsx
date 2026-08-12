'use client';

import { HeartHandshake } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetAfterCareCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetAfterCareCard({ section, variant = 'default', delay = 0.08 }: VetAfterCareCardProps) {
  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <div className="mb-3 flex items-center gap-2">
          <HeartHandshake className={`h-5 w-5 ${styles.accent}`} />
          <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
        </div>
        {section.body ? <p className="mb-3 text-sm text-slate-600">{section.body}</p> : null}
        <ul className="space-y-2">
          {(section.items ?? []).map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <span className="text-[#FF8C42]">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </SpecializationDetailSection>
  );
}
