'use client';

import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationOverviewProps = {
  title: string;
  body: string;
};

export function SpecializationOverview({ title, body }: SpecializationOverviewProps) {
  if (!body.trim()) return null;

  return (
    <SpecializationDetailSection
      delay={0.05}
      className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </SpecializationDetailSection>
  );
}
