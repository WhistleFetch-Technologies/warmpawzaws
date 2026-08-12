'use client';

import { AlertCircle } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';

type VetImportantNoticeProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  delay?: number;
};

export function VetImportantNotice({ section, variant = 'default', delay = 0.08 }: VetImportantNoticeProps) {
  const isWarning = section.tone === 'warning' || variant === 'emergency';
  const isInfo = section.tone === 'info';

  return (
    <SpecializationDetailSection delay={delay}>
      <div
        className={`rounded-[22px] border p-5 ${
          isWarning
            ? 'border-amber-200 bg-amber-50/90'
            : isInfo
              ? 'border-blue-100 bg-blue-50/60'
              : 'border-slate-200 bg-slate-50/80'
        }`}
      >
        <div className="flex gap-3">
          <AlertCircle
            className={`h-5 w-5 shrink-0 ${isWarning ? 'text-amber-600' : isInfo ? 'text-blue-600' : 'text-slate-600'}`}
          />
          <div>
            <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
            {section.body ? <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{section.body}</p> : null}
            {section.items?.length ? (
              <ul className="mt-2 space-y-1">
                {section.items.map((item) => (
                  <li key={item} className="text-sm text-slate-700">
                    • {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
