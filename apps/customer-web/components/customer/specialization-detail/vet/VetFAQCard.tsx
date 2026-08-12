'use client';

import { HelpCircle } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetFAQCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetFAQCard({ section, variant = 'default', delay = 0.08 }: VetFAQCardProps) {
  const styles = vetVariantClasses(variant);

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className={`h-5 w-5 ${styles.accent}`} />
          <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
        </div>
        <div className="space-y-3">
          {(section.faqs ?? []).map((faq) => (
            <div key={faq.question} className="rounded-2xl bg-slate-50/90 p-3.5">
              <p className="text-sm font-semibold text-slate-900">{faq.question}</p>
              <p className="mt-1 text-sm text-slate-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
