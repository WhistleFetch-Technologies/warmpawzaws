'use client';

import { XCircle } from 'lucide-react';
import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationNotIncludedProps = {
  items: string[];
  title?: string;
  footer?: string;
};

export function SpecializationNotIncluded({
  items,
  title = 'Not Included',
  footer,
}: SpecializationNotIncludedProps) {
  if (!items.length) return null;

  return (
    <SpecializationDetailSection
      delay={0.18}
      className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {footer ? <p className="mt-4 text-sm leading-relaxed text-slate-600">{footer}</p> : null}
    </SpecializationDetailSection>
  );
}
