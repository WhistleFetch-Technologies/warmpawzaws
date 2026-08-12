'use client';

import { Layers } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetCategoriesCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetCategoriesCard({ section, variant = 'default', delay = 0.08 }: VetCategoriesCardProps) {
  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <div className="mb-3 flex items-center gap-2">
          <Layers className={`h-5 w-5 ${styles.accent}`} />
          <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
        </div>
        {section.body ? <p className="mb-4 text-sm text-slate-600">{section.body}</p> : null}
        <div className="space-y-4">
          {(section.categories ?? []).map((category) => (
            <div key={category.title} className="rounded-2xl bg-slate-50/90 p-4">
              <h4 className="text-sm font-semibold text-slate-900">{category.title}</h4>
              <ul className="mt-2 space-y-1.5">
                {category.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-orange-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
