'use client';

import { CheckCircle2 } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetChecklistCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetChecklistCard({ section, variant = 'default', delay = 0.08 }: VetChecklistCardProps) {
  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <h3 className="mb-4 text-base font-bold text-slate-900">{section.title}</h3>
        {section.body ? <p className="mb-3 text-sm text-slate-600">{section.body}</p> : null}
        <ul className="space-y-3">
          {(section.items ?? []).map((item) => (
            <li key={item} className="flex gap-3 text-sm text-slate-700">
              <CheckCircle2 className={`h-5 w-5 shrink-0 ${styles.accent}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </SpecializationDetailSection>
  );
}
