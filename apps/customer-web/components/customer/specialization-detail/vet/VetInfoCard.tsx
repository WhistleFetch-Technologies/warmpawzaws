'use client';

import { Info } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetInfoCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetInfoCard({ section, variant = 'default', delay = 0.08 }: VetInfoCardProps) {
  const styles = vetVariantClasses(variant);
  const tone = section.tone ?? 'default';

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <div className="mb-3 flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 ${styles.accent}`}>
            <Info className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
        </div>
        {section.body ? (
          <p className={`mb-3 text-sm leading-relaxed ${tone === 'calm' ? 'text-slate-600' : 'text-slate-600'}`}>
            {section.body}
          </p>
        ) : null}
        {section.items?.length ? (
          <ul className="space-y-2">
            {section.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-600">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${variant === 'emergency' ? 'bg-red-400' : 'bg-orange-400'}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SpecializationDetailSection>
  );
}
