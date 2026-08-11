'use client';

import { Info } from 'lucide-react';
import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationImportantNotesProps = {
  title?: string;
  items: string[];
};

export function SpecializationImportantNotes({
  title = 'Important Information',
  items,
}: SpecializationImportantNotesProps) {
  if (!items.length) return null;

  return (
    <SpecializationDetailSection
      delay={0.22}
      className="rounded-[20px] border border-blue-100/80 bg-gradient-to-br from-blue-50/50 to-white p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-blue-600 shadow-sm">
          <Info className="h-4 w-4" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </SpecializationDetailSection>
  );
}
