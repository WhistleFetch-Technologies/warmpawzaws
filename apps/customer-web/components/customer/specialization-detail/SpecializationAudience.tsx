'use client';

import { CheckCircle2 } from 'lucide-react';
import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationAudienceProps = {
  items: string[];
  title?: string;
};

export function SpecializationAudience({
  items,
  title = 'Who Is This Service For?',
}: SpecializationAudienceProps) {
  return (
    <SpecializationDetailSection
      delay={0.16}
      className="rounded-[20px] border border-blue-100/80 bg-gradient-to-br from-blue-50/50 to-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42]" strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </SpecializationDetailSection>
  );
}
