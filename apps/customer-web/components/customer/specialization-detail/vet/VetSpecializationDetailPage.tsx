'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  isVetSpecializationDetail,
  resolveSpecializationDetail,
} from '@/lib/specialization-detail';
import { ServiceModeSelection, type ServiceStyle } from '../ServiceModeSelection';
import { SpecializationDetailSkeleton } from '../SpecializationDetailSkeleton';
import { DEFAULT_VET_SERVICE_MODE_INFORMATION } from '@/lib/specialization-detail/metadata/vet/vet-service-mode-defaults';
import { VetHeroCard } from './VetHeroCard';
import { VetHighlightChips } from './VetHighlightChips';
import { VetSectionRenderer } from './VetSectionRenderer';
import { vetVariantClasses } from './vet-variant-styles';

export type VetSpecializationProblem = {
  id: string;
  name: string;
  icon?: string | React.ReactNode;
  description?: string;
  category?: string;
  roleId?: string;
  linkedServiceRoles?: string[];
};

type VetSpecializationDetailPageProps = {
  problem: VetSpecializationProblem;
  availableStyles: ServiceStyle[];
  loadingProblemDetails?: boolean;
  hasTeleOption?: boolean;
  instantTeleEnabled?: boolean;
  onBack: () => void;
  onServiceStyleSelect: (style: ServiceStyle) => void;
};

export function VetSpecializationDetailPage({
  problem,
  availableStyles,
  loadingProblemDetails = false,
  hasTeleOption = false,
  instantTeleEnabled = false,
  onBack,
  onServiceStyleSelect,
}: VetSpecializationDetailPageProps) {
  const content = useMemo(
    () => resolveSpecializationDetail(problem.id),
    [problem.id],
  );

  const vetContent = isVetSpecializationDetail(content) ? content : null;
  const visualVariant = vetContent?.visualVariant ?? 'default';
  const pageStyles = vetVariantClasses(visualVariant);

  const iconNode =
    typeof problem.icon === 'string' ? (
      <span className="text-2xl">{problem.icon}</span>
    ) : (
      problem.icon
    );

  if (!vetContent) {
    return null;
  }

  if (loadingProblemDetails && availableStyles.length === 0) {
    return (
      <div className={`space-y-6 rounded-3xl p-1 ${pageStyles.pageBg}`}>
        <VetHeroCard
          title={vetContent.title}
          description={vetContent.description}
          heroImage={vetContent.heroImage}
          heroImagePosition={vetContent.heroImagePosition}
          variant={visualVariant}
          onBack={onBack}
          icon={iconNode}
        />
        <SpecializationDetailSkeleton />
      </div>
    );
  }

  return (
    <div className={`space-y-6 overflow-x-hidden pb-2 ${pageStyles.pageBg}`}>
      <div className="px-0.5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Veterinary specialization
        </p>
      </div>

      <VetHeroCard
        title={vetContent.title}
        description={vetContent.description}
        heroImage={vetContent.heroImage}
        heroImagePosition={vetContent.heroImagePosition}
        variant={visualVariant}
        onBack={onBack}
        icon={iconNode}
      />

      <VetHighlightChips chips={vetContent.highlightChips} variant={visualVariant} />

      {vetContent.sections.map((section, index) => (
        <VetSectionRenderer
          key={`${section.type}-${section.title}`}
          section={section}
          variant={visualVariant}
          index={index}
        />
      ))}

      <ServiceModeSelection
        availableStyles={availableStyles}
        specializationName={vetContent.title}
        loading={loadingProblemDetails}
        hasTeleOption={hasTeleOption}
        instantTeleEnabled={instantTeleEnabled}
        serviceModeInformation={{
          ...DEFAULT_VET_SERVICE_MODE_INFORMATION,
          ...vetContent.serviceModeInformation,
        }}
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
