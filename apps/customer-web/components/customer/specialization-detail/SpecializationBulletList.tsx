'use client';

import { CheckCircle2 } from 'lucide-react';
import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationBulletListProps = {
  title: string;
  items: string[];
  delay?: number;
};

export function SpecializationBulletList({
  title,
  items,
  delay = 0.08,
}: SpecializationBulletListProps) {
  if (!items.length) return null;

  return (
    <SpecializationDetailSection
      delay={delay}
      className="rounded-[24px] border border-slate-100 bg-gradient-to-br from-orange-50/40 to-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
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
