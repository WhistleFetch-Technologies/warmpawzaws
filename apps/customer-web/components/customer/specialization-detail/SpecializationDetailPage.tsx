'use client';

import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveSpecializationDetail } from '@/lib/specialization-detail';
import { SpecializationHeroCard } from './SpecializationHeroCard';
import { SpecializationHighlightChips } from './SpecializationHighlightChips';
import { SpecializationWhatsIncluded } from './SpecializationWhatsIncluded';
import { SpecializationBenefits } from './SpecializationBenefits';
import { SpecializationAudience } from './SpecializationAudience';
import { SpecializationTimeline } from './SpecializationTimeline';
import { SpecializationTipsBanner } from './SpecializationTipsBanner';
import { ServiceModeSelection, type ServiceStyle } from './ServiceModeSelection';
import { SpecializationDetailSkeleton } from './SpecializationDetailSkeleton';

export type SpecializationProblem = {
  id: string;
  name: string;
  icon?: string | React.ReactNode;
  description?: string;
  category?: string;
  roleId?: string;
  linkedServiceRoles?: string[];
};

type SpecializationDetailPageProps = {
  problem: SpecializationProblem;
  availableStyles: ServiceStyle[];
  loadingProblemDetails?: boolean;
  hasTeleOption?: boolean;
  instantTeleEnabled?: boolean;
  onBack: () => void;
  onServiceStyleSelect: (style: ServiceStyle) => void;
};

export function SpecializationDetailPage({
  problem,
  availableStyles,
  loadingProblemDetails = false,
  hasTeleOption = false,
  instantTeleEnabled = false,
  onBack,
  onServiceStyleSelect,
}: SpecializationDetailPageProps) {
  const content = useMemo(
    () => resolveSpecializationDetail(problem.id),
    [problem.id],
  );

  const iconNode =
    typeof problem.icon === 'string' ? (
      <span className="text-2xl">{problem.icon}</span>
    ) : (
      problem.icon
    );

  if (loadingProblemDetails && availableStyles.length === 0) {
    return (
      <div className="space-y-6">
        <HeaderBar title={content.title} onBack={onBack} />
        <SpecializationDetailSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-2">
      <HeaderBar title={content.title} onBack={onBack} />

      <SpecializationHeroCard content={content} icon={iconNode} />
      <SpecializationHighlightChips chips={content.highlightChips} />
      <SpecializationWhatsIncluded items={content.whatsIncluded} />
      <SpecializationBenefits items={content.benefits} />
      <SpecializationAudience items={content.whoIsThisFor} />
      <SpecializationTimeline items={content.timeline} />
      <SpecializationTipsBanner tips={content.tips} />

      <ServiceModeSelection
        availableStyles={availableStyles}
        specializationName={content.title}
        loading={loadingProblemDetails}
        hasTeleOption={hasTeleOption}
        instantTeleEnabled={instantTeleEnabled}
        onSelect={onServiceStyleSelect}
      />

      {!loadingProblemDetails && availableStyles.length === 0 && (
        <div className="text-center">
          <Button variant="outline" onClick={onBack} className="mt-2">
            Go Back
          </Button>
        </div>
      )}
    </div>
  );
}

function HeaderBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="relative z-10 h-11 min-h-[44px] min-w-[44px] shrink-0 p-0 touch-manipulation"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">Service details &amp; booking mode</p>
      </div>
    </div>
  );
}
