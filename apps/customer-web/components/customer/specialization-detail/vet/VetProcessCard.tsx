'use client';

import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { vetVariantClasses } from './vet-variant-styles';

type VetProcessCardProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetProcessCard({ section, variant = 'default', delay = 0.08 }: VetProcessCardProps) {
  const styles = vetVariantClasses(variant);
  const steps = section.steps ?? [];

  return (
    <SpecializationDetailSection delay={delay}>
      <div className={`rounded-[22px] border p-5 shadow-sm ${styles.card}`}>
        <h3 className="mb-2 text-base font-bold text-slate-900">{section.title}</h3>
        {section.body ? <p className="mb-4 text-sm text-slate-600">{section.body}</p> : null}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-3 rounded-2xl bg-orange-50/50 p-3.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                  variant === 'emergency' ? 'bg-red-500' : 'bg-[#FF8C42]'
                }`}
              >
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                {step.description ? (
                  <p className="mt-0.5 text-sm text-slate-600">{step.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
