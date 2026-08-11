'use client';

import { Siren } from 'lucide-react';
import { SpecializationDetailSection } from '../SpecializationDetailSection';
import type { VetSection } from '@/lib/specialization-detail';

type VetEmergencyNoticeProps = {
  section: VetSection;
  delay?: number;
};

export function VetEmergencyNotice({ section, delay = 0.08 }: VetEmergencyNoticeProps) {
  return (
    <SpecializationDetailSection delay={delay}>
      <div className="rounded-[22px] border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100/80 p-5 shadow-[0_4px_24px_rgba(220,38,38,0.15)]">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white">
            <Siren className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-red-900">{section.title}</h3>
            {section.body ? (
              <p className="mt-2 text-sm font-medium leading-relaxed text-red-800">{section.body}</p>
            ) : null}
          </div>
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
